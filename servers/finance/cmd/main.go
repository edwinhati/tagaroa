package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"golang.org/x/time/rate"

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	httputil "github.com/edwinhati/tagaroa/packages/shared/go/transport/http"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/config"
	"github.com/edwinhati/tagaroa/servers/finance/internal/repository"
	"github.com/edwinhati/tagaroa/servers/finance/internal/service"
	httphandler "github.com/edwinhati/tagaroa/servers/finance/internal/transport/http"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: Could not load .env file: %v", err)
	}

	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize allowed origins for CORS
	var allowedOrigins []string

	// Add production origins if configured
	if trustedOrigins := cfg.Server.TrustedOrigins; trustedOrigins != "" {
		origins := strings.Split(trustedOrigins, ",")
		for _, origin := range origins {
			if trimmed := strings.TrimSpace(origin); trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
	}

	log.Printf("🚀 Starting Finance Server")
	log.Printf("Environment: %s", cfg.Server.Env)
	log.Printf("Log level: %s", cfg.Log.Level)
	log.Printf("OIDC Issuer: %s", cfg.OIDC.IssuerURL())

	if cfg.Sentry.DSN != "" {
		log.Printf("Sentry enabled with sample rate: %.2f", cfg.Sentry.TracesSampleRate)
	}

	// Graceful shutdown setup
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Initialize database connection
	db, err := client.ConnectDatabase(
		cfg.Database.Host,
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Name,
		cfg.Database.Port,
	)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Note: Database migrations should be handled separately with a migration tool
	// For now, ensure the accounts table exists with the proper schema

	issuer := cfg.OIDC.IssuerURL()
	if issuer == "" {
		log.Fatal("OIDC issuer URL is required")
	}

	oidcClient, err := client.NewOIDCClient(ctx, client.OIDCConfig{
		IssuerURL: issuer,
		ClientID:  cfg.OIDC.ClientID,
	})
	if err != nil {
		log.Fatalf("Failed to initialize OIDC client: %v", err)
	}

	// Initialize repositories
	accountRepo := repository.NewAccountRepository(db)

	// Initialize services
	accountService := service.NewAccountService(accountRepo)

	// Initialize HTTP router
	router := httputil.NewRouter()

	// Initialize HTTP handlers
	httphandler.NewAccountHandler(oidcClient, accountService).SetupRoutes(router)

	// Create rate limiter (100 requests per minute per IP)
	rateLimiter := util.NewRateLimiter(rate.Every(time.Minute/100), 10)

	var handler http.Handler = router
	handler = util.RequestID(handler)
	handler = util.SecurityHeaders(handler)
	handler = util.CORS(allowedOrigins)(handler)
	handler = rateLimiter.RateLimit(handler)

	// Add health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"status": "ok",
			"timestamp": "` + time.Now().Format(time.RFC3339) + `",
			"service": "finance-server",
			"version": "1.0.0"
		}`))
	})

	// Create HTTP server
	server := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: handler,
	}
	// Start server
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for shutdown signal
	<-ctx.Done()
	slog.Info("📦 Shutting down services gracefully...")

	// Create a shutdown context with a timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Shutdown HTTP server
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server shutdown error", "error", err)
	}

	slog.Info("✅ Server terminated.")
}
