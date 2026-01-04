package main

import (
	"context"
	"database/sql"
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
	"github.com/edwinhati/tagaroa/packages/shared/go/middleware"
	"github.com/edwinhati/tagaroa/packages/shared/go/router"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/config"
	"github.com/edwinhati/tagaroa/servers/finance/internal/repository"
	"github.com/edwinhati/tagaroa/servers/finance/internal/service"
	httphandler "github.com/edwinhati/tagaroa/servers/finance/internal/transport"
	"github.com/joho/godotenv"
)

var (
	logFatalfFn = log.Fatalf
)

var runFn = run

func main() {
	if err := runFn(); err != nil {
		logFatalfFn("Application error: %v", err)
	}
}

func run() error {
	loadEnvFile()

	cfg := mustLoadConfig()
	logStartupInfo(cfg)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db := mustConnectDatabase(cfg)
	defer db.Close()

	oidcClient := mustInitOIDCClient(ctx, cfg)

	handler := buildHTTPHandler(
		db,
		oidcClient,
		parseAllowedOrigins(cfg.Server.TrustedOrigins),
	)

	registerHealthEndpoint()

	server := newHTTPServer(cfg.Server.Port, handler)
	go startServer(server)

	<-ctx.Done()
	gracefulShutdown(server)
	return nil
}

func loadEnvFile() {
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: Could not load .env file: %v", err)
	}
}

func mustLoadConfig() *config.Config {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}
	return cfg
}

func logStartupInfo(cfg *config.Config) {
	log.Printf("🚀 Starting Finance Server")
	log.Printf("Environment: %s", cfg.Server.Env)
	log.Printf("Log level: %s", cfg.Log.Level)
	log.Printf("OIDC Issuer: %s", cfg.OIDC.IssuerURL())

	if cfg.Sentry.DSN != "" {
		log.Printf("Sentry enabled with sample rate: %.2f", cfg.Sentry.TracesSampleRate)
	}
}

func parseAllowedOrigins(trustedOrigins string) []string {
	if trustedOrigins == "" {
		return nil
	}
	var origins []string
	for origin := range strings.SplitSeq(trustedOrigins, ",") {
		if trimmed := strings.TrimSpace(origin); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}

func mustConnectDatabase(cfg *config.Config) *sql.DB {
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
	return db
}

func mustInitOIDCClient(ctx context.Context, cfg *config.Config) *client.OIDCClient {
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
	return oidcClient
}

func buildHTTPHandler(
	db *sql.DB,
	oidcClient *client.OIDCClient,
	allowedOrigins []string,
) http.Handler {
	accountRepo := repository.NewAccountRepository(db)
	transactionRepo := repository.NewTransactionRepository(db)
	budgetRepo := repository.NewBudgetRepository(db)
	accountService := service.NewAccountService(accountRepo)
	transactionService := service.NewTransactionService(transactionRepo, accountRepo)
	budgetService := service.NewBudgetService(budgetRepo)

	router := router.NewRouter()
	httphandler.NewAccountHandler(oidcClient, accountService).SetupRoutes(router)
	httphandler.NewBudgetHandler(oidcClient, budgetService).SetupRoutes(router)
	httphandler.NewTransactionHandler(oidcClient, transactionService).SetupRoutes(router)

	return applyMiddlewares(router, allowedOrigins)
}

func applyMiddlewares(router http.Handler, allowedOrigins []string) http.Handler {
	rateLimiter := middleware.NewRateLimiter(rate.Every(time.Minute/100), 10)

	handler := http.Handler(router)
	handler = util.RequestID(handler)
	handler = util.SecurityHeaders(handler)
	handler = util.CORS(allowedOrigins)(handler)
	return rateLimiter.RateLimit(handler)
}

func registerHealthEndpoint() {
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
}

func newHTTPServer(port string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:    ":" + port,
		Handler: handler,
	}
}

func startServer(server *http.Server) {
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func gracefulShutdown(server *http.Server) {
	slog.Info("📦 Shutting down services gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server shutdown error", "error", err)
	}

	slog.Info("✅ Server terminated.")
}
