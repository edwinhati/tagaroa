package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/config"
	infrahttp "github.com/edwinhati/tagaroa/servers/finance/internal/infrastructure/http"
	httphandler "github.com/edwinhati/tagaroa/servers/finance/internal/transport"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/client"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/middleware"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/util"
	"go.uber.org/zap"
)

type App struct {
	Server *http.Server
	Logger *zap.SugaredLogger
}

func NewApp(
	cfg *config.Config,
	logger *zap.SugaredLogger,
	db *sql.DB,
	accountHandler *httphandler.AccountHandler,
	transactionHandler *httphandler.TransactionHandler,
	budgetHandler *httphandler.BudgetHandler,
	investmentHandler *httphandler.InvestmentHandler,
	dashboardHandler *httphandler.DashboardHandler,
	oidcClient *client.OIDCClient,
) *App {
	router := infrahttp.NewRouter()

	// CORS
	var allowedOrigins []string
	if cfg.Server.TrustedOrigins != "" {
		for origin := range strings.SplitSeq(cfg.Server.TrustedOrigins, ",") {
			if trimmed := strings.TrimSpace(origin); trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
	} else {
		allowedOrigins = []string{"*"}
	}

	// Register global OPTIONS handler for CORS preflight
	// This must be registered before other routes to catch OPTIONS requests
	router.HandleOptions(allowedOrigins)

	// Base middleware
	baseMiddleware := []func(http.Handler) http.Handler{
		util.RequestID,
		util.SecurityHeaders,
		util.CORS(allowedOrigins),
	}

	// Public group
	publicGroup := router.Group("/", baseMiddleware...)
	registerHealthEndpoint(publicGroup)
	registerReadyEndpoint(publicGroup, db)
	registerMetricsEndpoint(publicGroup)

	// Protected group
	// We manually append AuthMiddleware to baseMiddleware
	protectedMiddleware := make([]func(http.Handler) http.Handler, len(baseMiddleware)+1)
	copy(protectedMiddleware, baseMiddleware)
	protectedMiddleware[len(baseMiddleware)] = middleware.AuthMiddleware(oidcClient)

	protectedGroup := router.Group("/", protectedMiddleware...)

	// Setup Routes
	accountHandler.SetupRoutes(protectedGroup)
	transactionHandler.SetupRoutes(protectedGroup)
	budgetHandler.SetupRoutes(protectedGroup)
	investmentHandler.SetupRoutes(protectedGroup)
	dashboardHandler.SetupRoutes(protectedGroup)

	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router,
		ReadTimeout:  time.Second * 15,
		WriteTimeout: time.Second * 15,
		IdleTimeout:  time.Second * 60,
	}

	return &App{
		Server: srv,
		Logger: logger,
	}
}

func (a *App) Run() error {
	a.Logger.Infow("Starting server", "addr", a.Server.Addr)
	return a.Server.ListenAndServe()
}

func (a *App) Shutdown(ctx context.Context) error {
	a.Logger.Infow("Shutting down server")
	return a.Server.Shutdown(ctx)
}

func registerHealthEndpoint(router *infrahttp.RouterGroup) {
	router.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"status": "ok",
			"timestamp": "` + time.Now().Format(time.RFC3339) + `",
			"service": "finance-server",
			"version": "2.0.0-ddd"
		}`))
	})
}

func registerReadyEndpoint(router *infrahttp.RouterGroup, db *sql.DB) {
	router.HandleFunc("GET /ready", func(w http.ResponseWriter, r *http.Request) {
		checks := make(map[string]bool)

		// Check database connectivity
		if db != nil {
			if err := db.Ping(); err == nil {
				checks["database"] = true
			} else {
				checks["database"] = false
			}
		} else {
			checks["database"] = false
		}

		allHealthy := true
		for _, healthy := range checks {
			if !healthy {
				allHealthy = false
				break
			}
		}

		status := "ready"
		statusCode := http.StatusOK
		if !allHealthy {
			status = "degraded"
			statusCode = http.StatusServiceUnavailable
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)

		checksJSON, _ := json.Marshal(checks)
		w.Write([]byte(`{
			"status": "` + status + `",
			"checks": ` + string(checksJSON) + `,
			"timestamp": "` + time.Now().Format(time.RFC3339) + `",
			"service": "finance-server",
			"version": "2.0.0-ddd"
		}`))
	})
}

func registerMetricsEndpoint(router *infrahttp.RouterGroup) {
	// Assuming MetricsHandler returns http.HandlerFunc or http.Handler
	// infrahttp.RouterGroup.Handle takes http.Handler
	// infrahttp.RouterGroup.HandleFunc takes http.HandlerFunc
	// httphandler.MetricsHandler returns http.Handler
	router.Handle("GET /metrics", httphandler.MetricsHandler())
}
