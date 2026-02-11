package middleware

import (
	"net/http"
	"time"
)

// MetricsRecorder is a callback function to record metrics
type MetricsRecorder func(method, route string, status int, duration float64)

// MetricsMiddleware records HTTP request metrics using the provided recorder callback
func MetricsMiddleware(recorder MetricsRecorder) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Wrap response writer to capture status code
			wrapped := &responseWriter{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(wrapped, r)

			duration := time.Since(start).Seconds()
			recorder(r.Method, r.URL.Path, wrapped.status, duration)
		})
	}
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (w *responseWriter) WriteHeader(statusCode int) {
	w.status = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}
