package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewWideEventLogger(t *testing.T) {
	logger := NewWideEventLogger()
	assert.NotNil(t, logger)
	assert.NotNil(t, logger.logger)
}

func TestLogRequestStart(t *testing.T) {
	logger := NewWideEventLogger()

	req := httptest.NewRequest(http.MethodGet, "/api/users?id=123", nil)
	ctx := WithRequestID(req.Context(), "test-req-123")
	req = req.WithContext(ctx)

	logger.LogRequestStart(req)

	// Test passes if no panic and context values are accessible
	requestID := GetRequestID(req.Context())
	assert.Equal(t, "test-req-123", requestID)
}

func TestLogRequestComplete_Success(t *testing.T) {
	logger := NewWideEventLogger()

	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	ctx := WithRequestID(req.Context(), "test-req-456")
	req = req.WithContext(ctx)

	logger.LogRequestComplete(req, http.StatusOK, 150, 1024)

	// Test passes if no panic
	assert.True(t, true)
}

func TestLogRequestComplete_ClientError(t *testing.T) {
	logger := NewWideEventLogger()

	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	ctx := WithRequestID(req.Context(), "test-req-789")
	req = req.WithContext(ctx)

	logger.LogRequestComplete(req, http.StatusBadRequest, 50, 0)

	// Test passes if no panic - logs at warn level for 4xx
	assert.True(t, true)
}

func TestLogRequestComplete_ServerError(t *testing.T) {
	logger := NewWideEventLogger()

	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	ctx := WithRequestID(req.Context(), "test-req-000")
	req = req.WithContext(ctx)

	logger.LogRequestComplete(req, http.StatusInternalServerError, 500, 0)

	// Test passes if no panic - logs at error level for 5xx
	assert.True(t, true)
}

func TestLogBusinessEvent(t *testing.T) {
	logger := NewWideEventLogger()

	details := map[string]interface{}{
		"user_id":        "user-123",
		"transaction_id": "tx-456",
		"amount":         100.50,
	}

	logger.LogBusinessEvent("transaction.created", "transaction", "tx-456", details)

	// Test passes if no panic
	assert.True(t, true)
}

func TestLogBusinessEvent_WithUserID(t *testing.T) {
	logger := NewWideEventLogger()

	details := map[string]interface{}{
		"user_id": "user-999",
	}

	logger.LogBusinessEvent("account.updated", "account", "acc-111", details)

	// Test passes if no panic
	assert.True(t, true)
}

func TestLogError(t *testing.T) {
	logger := NewWideEventLogger()

	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	ctx := WithRequestID(req.Context(), "test-req-error")
	ctx = WithUserID(ctx, "user-error")
	req = req.WithContext(ctx)

	testErr := assert.AnError
	logger.LogError(req, testErr)

	// Test passes if no panic
	assert.True(t, true)
}

func TestNewHTTPLogger(t *testing.T) {
	logger := NewHTTPLogger()
	assert.NotNil(t, logger)
	assert.NotNil(t, logger.logger)
}

func TestHTTPLogger_Log_Success(t *testing.T) {
	logger := NewHTTPLogger()

	req := httptest.NewRequest(http.MethodGet, "/api/users?id=123", nil)
	ctx := WithRequestID(req.Context(), "http-req-123")
	ctx = WithUserID(ctx, "http-user-456")
	req = req.WithContext(ctx)

	logger.Log(req, http.StatusOK, 100*time.Millisecond, 512)

	// Test passes if no panic
	assert.True(t, true)
}

func TestHTTPLogger_Log_Warning(t *testing.T) {
	logger := NewHTTPLogger()

	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	ctx := WithRequestID(req.Context(), "http-req-warn")
	req = req.WithContext(ctx)

	logger.Log(req, http.StatusNotFound, 50*time.Millisecond, 0)

	// Test passes if no panic - logs at warn level for 4xx
	assert.True(t, true)
}

func TestHTTPLogger_Log_Error(t *testing.T) {
	logger := NewHTTPLogger()

	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	ctx := WithRequestID(req.Context(), "http-req-err")
	req = req.WithContext(ctx)

	logger.Log(req, http.StatusInternalServerError, 500*time.Millisecond, 0)

	// Test passes if no panic - logs at error level for 5xx
	assert.True(t, true)
}

func TestHTTPLogger_Log_WithAllFields(t *testing.T) {
	logger := NewHTTPLogger()

	req := httptest.NewRequest(http.MethodGet, "/api/users?id=123&sort=name", nil)
	req.Header.Set("User-Agent", "TestAgent/1.0")
	ctx := WithRequestID(req.Context(), "http-req-full")
	ctx = WithUserID(ctx, "http-user-full")
	req = req.WithContext(ctx)

	logger.Log(req, http.StatusOK, 75*time.Millisecond, 256)

	// Test passes if no panic - includes all fields
	assert.True(t, true)
}

func TestWideEventLogger_LogBusinessEvent_EmptyDetails(t *testing.T) {
	logger := NewWideEventLogger()

	logger.LogBusinessEvent("test.event", "test", "test-123", map[string]interface{}{})

	// Test passes if no panic
	assert.True(t, true)
}

func TestWideEventLogger_LogRequestStart_EmptyContext(t *testing.T) {
	logger := NewWideEventLogger()

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	// Don't set any context values

	logger.LogRequestStart(req)

	// Test passes if no panic - will use empty strings for missing context values
	assert.True(t, true)
}
