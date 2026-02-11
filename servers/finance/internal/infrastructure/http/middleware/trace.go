package middleware

import (
	"context"
	"net/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

// TraceContextKey is the context key for storing trace ID
type TraceContextKey struct{}

// TraceMiddleware adds the trace ID to the request context
func TraceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Get the current span from context
		span := trace.SpanFromContext(ctx)
		if span.SpanContext().IsValid() {
			// Store trace ID in context for error handlers
			traceID := span.SpanContext().TraceID().String()
			ctx = context.WithValue(ctx, TraceContextKey{}, traceID)
			r = r.WithContext(ctx)
		}

		next.ServeHTTP(w, r)
	})
}

// GetTraceID retrieves the trace ID from the request context
func GetTraceID(r *http.Request) string {
	if traceID, ok := r.Context().Value(TraceContextKey{}).(string); ok {
		return traceID
	}
	return ""
}

// GetTracer returns a tracer for the given service name
func GetTracer(serviceName string) trace.Tracer {
	return otel.Tracer(serviceName)
}
