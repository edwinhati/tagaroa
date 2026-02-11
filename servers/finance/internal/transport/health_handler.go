package httphandler

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/pkg/util"
)

const (
	serviceName    = "finance-server"
	serviceVersion = "1.0.0"
)

// HealthResponse represents the health check response
type HealthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	Service   string `json:"service"`
	Version   string `json:"version"`
}

// ReadyResponse represents the readiness check response
type ReadyResponse struct {
	Status    string          `json:"status"`
	Checks    map[string]bool `json:"checks"`
	Timestamp string          `json:"timestamp"`
	Service   string          `json:"service"`
	Version   string          `json:"version"`
}

// HealthHandler handles health and readiness endpoints
type HealthHandler struct {
	db *sql.DB
}

// NewHealthHandler creates a new HealthHandler
func NewHealthHandler(db *sql.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

// Health returns a simple health check response
func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	response := HealthResponse{
		Status:    "ok",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Service:   serviceName,
		Version:   serviceVersion,
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, response, util.JsonApiMeta{
		Message: "Health check passed",
	}, nil)
}

// Ready checks all dependencies and returns readiness status
func (h *HealthHandler) Ready(w http.ResponseWriter, r *http.Request) {
	checks := make(map[string]bool)

	// Check database connectivity
	checks["database"] = h.checkDatabase()

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

	response := ReadyResponse{
		Status:    status,
		Checks:    checks,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Service:   serviceName,
		Version:   serviceVersion,
	}

	util.WriteJsonApiResponse(w, r, statusCode, response, util.JsonApiMeta{
		Message: "Readiness check completed",
	}, nil)
}

func (h *HealthHandler) checkDatabase() bool {
	if h.db == nil {
		return false
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := h.db.PingContext(ctx); err != nil {
		return false
	}

	return true
}
