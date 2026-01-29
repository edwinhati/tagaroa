package middleware

import (
	"net/http"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
	"go.uber.org/zap"
)

type WideEventLogger struct {
	logger *zap.SugaredLogger
}

func NewWideEventLogger() *WideEventLogger {
	return &WideEventLogger{
		logger: logger.New().With("component", "wide_event_logging"),
	}
}

func (l *WideEventLogger) LogRequestStart(r *http.Request) {
	requestID := GetRequestID(r.Context())
	userID := GetUserIDFromContext(r.Context())
	l.logger.Infow("http_request_started",
		"event_type", "http_request",
		"request_id", requestID,
		"method", r.Method,
		"path", r.URL.Path,
		"query", r.URL.RawQuery,
		"user_id", userID,
		"remote_addr", r.RemoteAddr,
		"user_agent", r.UserAgent(),
	)
}

func (l *WideEventLogger) LogRequestComplete(r *http.Request, statusCode int, durationMs int64, bytesWritten int64) {
	requestID := GetRequestID(r.Context())
	userID := GetUserIDFromContext(r.Context())

	logMethod := l.logger.Infow
	if statusCode >= 500 {
		logMethod = l.logger.Errorw
	} else if statusCode >= 400 {
		logMethod = l.logger.Warnw
	}

	logMethod("http_request_completed",
		"event_type", "http_request",
		"request_id", requestID,
		"method", r.Method,
		"path", r.URL.Path,
		"status", statusCode,
		"duration_ms", durationMs,
		"bytes_written", bytesWritten,
		"user_id", userID,
	)
}

func (l *WideEventLogger) LogBusinessEvent(eventType string, resourceType string, resourceID string, details map[string]interface{}) {
	userID := details["user_id"]
	fields := []interface{}{
		"event_type", eventType,
		"user_id", userID,
		"resource_type", resourceType,
		"resource_id", resourceID,
	}
	for k, v := range details {
		fields = append(fields, k, v)
	}
	l.logger.Infow("business_event", fields...)
}

func (l *WideEventLogger) LogError(r *http.Request, err error) {
	requestID := GetRequestID(r.Context())
	userID := GetUserIDFromContext(r.Context())
	l.logger.Errorw("http_request_error",
		"event_type", "http_error",
		"request_id", requestID,
		"method", r.Method,
		"path", r.URL.Path,
		"error", err.Error(),
		"user_id", userID,
	)
}

type HTTPLogger struct {
	logger *zap.SugaredLogger
}

func NewHTTPLogger() *HTTPLogger {
	return &HTTPLogger{
		logger: logger.New().With("component", "http_access"),
	}
}

func (l *HTTPLogger) Log(r *http.Request, statusCode int, duration time.Duration, bytesWritten int64) {
	requestID := GetRequestID(r.Context())
	userID := GetUserIDFromContext(r.Context())

	level := "info"
	if statusCode >= 500 {
		level = "error"
	} else if statusCode >= 400 {
		level = "warn"
	}

	logArgs := []interface{}{
		"request_id", requestID,
		"method", r.Method,
		"path", r.URL.Path,
		"status", statusCode,
		"duration_ms", duration.Milliseconds(),
		"bytes_written", bytesWritten,
		"user_id", userID,
		"query", r.URL.RawQuery,
		"remote_addr", r.RemoteAddr,
		"user_agent", r.UserAgent(),
	}

	switch level {
	case "error":
		l.logger.Errorw("http_access", logArgs...)
	case "warn":
		l.logger.Warnw("http_access", logArgs...)
	default:
		l.logger.Infow("http_access", logArgs...)
	}
}
