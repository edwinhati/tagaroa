package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/config"
	"github.com/edwinhati/tagaroa/servers/finance/internal/infrastructure/telemetry"
	"github.com/joho/godotenv"
)

var (
	logFatalfFn      = log.Fatalf
	runFn            = run
	loadEnvFileFn    = loadEnvFile
	mustLoadConfigFn = mustLoadConfig
	initializeAppFn  = InitializeApp
)

func init() {
	// Initialize logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)
}

func loadEnvFile() {
	// Try to load .env file for local development
	// Ignore errors in production (env vars may be set directly)
	_ = godotenv.Load()
}

func main() {
	if err := runFn(); err != nil {
		logFatalfFn("Application error: %v", err)
	}
}

func run() error {
	loadEnvFileFn()
	cfg := mustLoadConfigFn()
	logStartupInfo(cfg)

	// Initialize OpenTelemetry
	_, telemetryErr := telemetry.InitTelemetry(telemetry.Config{
		ServiceName: "finance-server",
		Endpoint:    os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
		SampleRate:  1.0,
	})
	if telemetryErr != nil {
		log.Printf("Warning: Failed to initialize telemetry: %v", telemetryErr)
	}

	app, cleanup, err := initializeAppFn(cfg)
	if err != nil {
		return err
	}
	defer cleanup()

	// Handle graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		if err := app.Run(); err != nil && err != http.ErrServerClosed {
			logFatalfFn("Failed to start server: %v", err)
		}
	}()

	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := app.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server shutdown error", "error", err)
	}

	slog.Info("✅ Server terminated.")
	return nil
}

func mustLoadConfig() *config.Config {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}
	return cfg
}

func logStartupInfo(cfg *config.Config) {
	log.Printf("🚀 Starting Finance Server (Wire DI)")
	log.Printf("Environment: %s", cfg.Server.Env)
	log.Printf("Log level: %s", cfg.Log.Level)
	log.Printf("Trusted Origins: %s", cfg.Server.TrustedOrigins)
	log.Printf("OIDC Issuer: %s", cfg.OIDC.IssuerURL())

	if cfg.Sentry.DSN != "" {
		log.Printf("Sentry enabled with sample rate: %.2f", cfg.Sentry.TracesSampleRate)
	}
}
