package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestWithRequestID(t *testing.T) {
	ctx := context.Background()
	requestID := "test-request-123"

	newCtx := WithRequestID(ctx, requestID)

	assert.Equal(t, requestID, GetRequestID(newCtx))
}

func TestWithRequestID_EmptyContext(t *testing.T) {
	ctx := context.Background()

	requestID := GetRequestID(ctx)

	assert.Empty(t, requestID)
}

func TestWithUserID(t *testing.T) {
	ctx := context.Background()
	userID := "user-456"

	newCtx := WithUserID(ctx, userID)

	assert.Equal(t, userID, GetUserIDFromContext(newCtx))
}

func TestGetUserIDFromContext_EmptyContext(t *testing.T) {
	ctx := context.Background()

	userID := GetUserIDFromContext(ctx)

	assert.Empty(t, userID)
}

func TestGetRequestID_Overwrites(t *testing.T) {
	ctx := WithRequestID(context.Background(), "first-id")
	ctx = WithRequestID(ctx, "second-id")

	assert.Equal(t, "second-id", GetRequestID(ctx))
}

func TestLoggingMiddleware(t *testing.T) {
	middleware := NewLoggingMiddleware()
	handler := middleware.LoggingMiddleware()

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	req := httptest.NewRequest(http.MethodGet, "/test?query=value", nil)
	rr := httptest.NewRecorder()

	handler(nextHandler).ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), "OK")
}

func TestLoggingMiddleware_GeneratesRequestID(t *testing.T) {
	middleware := NewLoggingMiddleware()
	handler := middleware.LoggingMiddleware()

	var capturedRequestID string
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedRequestID = GetRequestID(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	// Don't set X-Request-ID header
	rr := httptest.NewRecorder()

	handler(nextHandler).ServeHTTP(rr, req)

	// Should generate a new request ID in context
	assert.NotEmpty(t, capturedRequestID)
}

func TestLoggingMiddleware_PreservesExistingRequestID(t *testing.T) {
	middleware := NewLoggingMiddleware()
	handler := middleware.LoggingMiddleware()

	var capturedRequestID string
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedRequestID = GetRequestID(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	existingID := "my-custom-request-id"
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Request-ID", existingID)
	rr := httptest.NewRecorder()

	handler(nextHandler).ServeHTTP(rr, req)

	// Should preserve the existing request ID in context
	assert.Equal(t, existingID, capturedRequestID)
}

func TestRequestIDMiddleware(t *testing.T) {
	middleware := RequestIDMiddleware()

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := GetRequestID(r.Context())
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(requestID))
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rr := httptest.NewRecorder()

	middleware(nextHandler).ServeHTTP(rr, req)

	assert.NotEmpty(t, rr.Header().Get("X-Request-ID"))
}

func TestRequestIDMiddleware_GeneratesUUID(t *testing.T) {
	middleware := RequestIDMiddleware()

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rr := httptest.NewRecorder()

	middleware(nextHandler).ServeHTTP(rr, req)

	requestID := rr.Header().Get("X-Request-ID")
	assert.NotEmpty(t, requestID)
	assert.Len(t, requestID, 36) // UUID format
}

func TestResponseWriter_Write(t *testing.T) {
	rr := httptest.NewRecorder()
	rw := &responseWriter{ResponseWriter: rr, statusCode: http.StatusOK, written: 0}

	n, err := rw.Write([]byte("hello"))

	assert.NoError(t, err)
	assert.Equal(t, 5, n)
	assert.Equal(t, int64(5), rw.written)
	assert.Equal(t, "hello", rr.Body.String())
}

func TestResponseWriter_WriteHeader(t *testing.T) {
	rr := httptest.NewRecorder()
	rw := &responseWriter{ResponseWriter: rr, statusCode: http.StatusOK, written: 0}

	rw.WriteHeader(http.StatusCreated)

	assert.Equal(t, http.StatusCreated, rw.statusCode)
	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestContextHelpers_Chaining(t *testing.T) {
	ctx := context.Background()
	ctx = WithRequestID(ctx, "req-123")
	ctx = WithUserID(ctx, "user-456")

	assert.Equal(t, "req-123", GetRequestID(ctx))
	assert.Equal(t, "user-456", GetUserIDFromContext(ctx))
}
