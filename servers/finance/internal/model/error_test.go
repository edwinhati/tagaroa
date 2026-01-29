package model

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAPIError_Error(t *testing.T) {
	err := &APIError{
		Code:    ErrCodeNotFound,
		Message: "Resource not found",
	}

	assert.Equal(t, "NOT_FOUND: Resource not found", err.Error())
}

func TestAPIErrorToHTTPStatus(t *testing.T) {
	tests := []struct {
		name     string
		errCode  ErrorCode
		expected int
	}{
		{"InvalidRequest maps to 400", ErrCodeInvalidRequest, http.StatusBadRequest},
		{"Unauthorized maps to 401", ErrCodeUnauthorized, http.StatusUnauthorized},
		{"Forbidden maps to 403", ErrCodeForbidden, http.StatusForbidden},
		{"NotFound maps to 404", ErrCodeNotFound, http.StatusNotFound},
		{"Conflict maps to 409", ErrCodeConflict, http.StatusConflict},
		{"ValidationFailed maps to 400", ErrCodeValidationFailed, http.StatusBadRequest},
		{"InternalError maps to 500", ErrCodeInternalError, http.StatusInternalServerError},
		{"ServiceUnavailable maps to 500", ErrCodeServiceUnavailable, http.StatusInternalServerError},
		{"Unknown maps to 500", ErrorCode("unknown"), http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := APIErrorToHTTPStatus(tt.errCode)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestErrToAPIError_WithAPIError(t *testing.T) {
	original := &APIError{
		Code:    ErrCodeNotFound,
		Message: "User not found",
	}

	result := ErrToAPIError(original)

	assert.Equal(t, ErrCodeNotFound, result.Code)
	assert.Equal(t, "User not found", result.Message)
}

func TestErrToAPIError_WithGenericError(t *testing.T) {
	original := assert.AnError

	result := ErrToAPIError(original)

	assert.Equal(t, ErrCodeInternalError, result.Code)
	assert.Equal(t, assert.AnError.Error(), result.Message)
}

func TestErrorCode_Values(t *testing.T) {
	// Verify all error codes have expected string representations
	assert.Equal(t, ErrorCode("INVALID_REQUEST"), ErrCodeInvalidRequest)
	assert.Equal(t, ErrorCode("UNAUTHORIZED"), ErrCodeUnauthorized)
	assert.Equal(t, ErrorCode("FORBIDDEN"), ErrCodeForbidden)
	assert.Equal(t, ErrorCode("NOT_FOUND"), ErrCodeNotFound)
	assert.Equal(t, ErrorCode("CONFLICT"), ErrCodeConflict)
	assert.Equal(t, ErrorCode("VALIDATION_FAILED"), ErrCodeValidationFailed)
	assert.Equal(t, ErrorCode("INTERNAL_ERROR"), ErrCodeInternalError)
	assert.Equal(t, ErrorCode("SERVICE_UNAVAILABLE"), ErrCodeServiceUnavailable)
}

func TestPredefinedErrors(t *testing.T) {
	assert.Equal(t, ErrCodeValidationFailed, ErrInvalidAccountType.Code)
	assert.Equal(t, "Invalid account type", ErrInvalidAccountType.Message)

	assert.Equal(t, ErrCodeValidationFailed, ErrInvalidTransactionType.Code)
	assert.Equal(t, "Invalid transaction type", ErrInvalidTransactionType.Message)

	assert.Equal(t, ErrCodeNotFound, ErrAccountNotFound.Code)
	assert.Equal(t, "Account not found", ErrAccountNotFound.Message)

	assert.Equal(t, ErrCodeForbidden, ErrAccountAccessDenied.Code)
	assert.Equal(t, "Access denied to this account", ErrAccountAccessDenied.Message)

	assert.Equal(t, ErrCodeUnauthorized, ErrUnauthorized.Code)
	assert.Equal(t, "Authentication required", ErrUnauthorized.Message)

	assert.Equal(t, ErrCodeInternalError, ErrDatabaseError.Code)
	assert.Equal(t, "Database operation failed", ErrDatabaseError.Message)
}
