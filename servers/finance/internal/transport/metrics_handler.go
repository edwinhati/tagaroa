package httphandler

import (
	"fmt"
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "route", "status"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Duration of HTTP requests in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "route", "status"},
	)
)

// MetricsHandler returns the Prometheus metrics handler
func MetricsHandler() http.Handler {
	return promhttp.Handler()
}

// RecordRequest records metrics for an HTTP request
func RecordRequest(method, route string, status int, duration float64) {
	statusStr := http.StatusText(status)
	if statusStr == "" {
		statusStr = fmt.Sprintf("%d", status)
	}
	httpRequestsTotal.WithLabelValues(method, route, statusStr).Inc()
	httpRequestDuration.WithLabelValues(method, route, statusStr).Observe(duration)
}
