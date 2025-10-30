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

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	"github.com/edwinhati/tagaroa/packages/shared/go/middleware"
	httputil "github.com/edwinhati/tagaroa/packages/shared/go/transport/http"
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

	log.Printf("🚀 Starting Finance Server on %s", cfg.Server.Port)
	log.Printf("Environment: %s", cfg.Server.Env)
	log.Printf("Log level: %s", cfg.Log.Level)

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

	// middleware
	corsMiddleware := middleware.CORS(middleware.DefaultCORSConfig())

	// Initialize HTTP handlers (without CORS middleware at route level)
	httphandler.NewAccountHandler(oidcClient, accountService).SetupRoutes(router)

	// Apply CORS middleware globally to the entire router
	var handler http.Handler = router
	handler = corsMiddleware(handler)

	// Create HTTP server
	server := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: handler,
	}
	// Start server
	log.Printf("🌐 Server starting on %s", cfg.Server.Port)
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
