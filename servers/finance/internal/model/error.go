package model

import (
	"errors"
	"net/http"
)

type ErrorCode string

const (
	ErrCodeInvalidRequest     ErrorCode = "INVALID_REQUEST"
	ErrCodeUnauthorized       ErrorCode = "UNAUTHORIZED"
	ErrCodeForbidden          ErrorCode = "FORBIDDEN"
	ErrCodeNotFound           ErrorCode = "NOT_FOUND"
	ErrCodeConflict           ErrorCode = "CONFLICT"
	ErrCodeValidationFailed   ErrorCode = "VALIDATION_FAILED"
	ErrCodeInternalError      ErrorCode = "INTERNAL_ERROR"
	ErrCodeServiceUnavailable ErrorCode = "SERVICE_UNAVAILABLE"
)

type APIError struct {
	Code       ErrorCode `json:"code"`
	Message    string    `json:"message"`
	Details    string    `json:"details,omitempty"`
	RequestID  string    `json:"request_id,omitempty"`
	ResourceID string    `json:"resource_id,omitempty"`
}

func (e *APIError) Error() string {
	return string(e.Code) + ": " + e.Message
}

var (
	ErrInvalidAccountType = &APIError{
		Code:    ErrCodeValidationFailed,
		Message: "Invalid account type",
	}
	ErrInvalidTransactionType = &APIError{
		Code:    ErrCodeValidationFailed,
		Message: "Invalid transaction type",
	}
	ErrInvalidAssetType = &APIError{
		Code:    ErrCodeValidationFailed,
		Message: "Invalid asset type",
	}
	ErrInvalidLiabilityType = &APIError{
		Code:    ErrCodeValidationFailed,
		Message: "Invalid liability type",
	}
	ErrAccountNotFound = &APIError{
		Code:    ErrCodeNotFound,
		Message: "Account not found",
	}
	ErrTransactionNotFound = &APIError{
		Code:    ErrCodeNotFound,
		Message: "Transaction not found",
	}
	ErrBudgetNotFound = &APIError{
		Code:    ErrCodeNotFound,
		Message: "Budget not found",
	}
	ErrAssetNotFound = &APIError{
		Code:    ErrCodeNotFound,
		Message: "Asset not found",
	}
	ErrLiabilityNotFound = &APIError{
		Code:    ErrCodeNotFound,
		Message: "Liability not found",
	}
	ErrAccountAccessDenied = &APIError{
		Code:    ErrCodeForbidden,
		Message: "Access denied to this account",
	}
	ErrTransactionAccessDenied = &APIError{
		Code:    ErrCodeForbidden,
		Message: "Access denied to this transaction",
	}
	ErrBudgetAccessDenied = &APIError{
		Code:    ErrCodeForbidden,
		Message: "Access denied to this budget",
	}
	ErrAssetAccessDenied = &APIError{
		Code:    ErrCodeForbidden,
		Message: "Access denied to this asset",
	}
	ErrLiabilityAccessDenied = &APIError{
		Code:    ErrCodeForbidden,
		Message: "Access denied to this liability",
	}
	ErrUnauthorized = &APIError{
		Code:    ErrCodeUnauthorized,
		Message: "Authentication required",
	}
	ErrInternalError = &APIError{
		Code:    ErrCodeInternalError,
		Message: "An internal error occurred",
	}
	ErrDatabaseError = &APIError{
		Code:    ErrCodeInternalError,
		Message: "Database operation failed",
	}
)

func ErrToAPIError(err error) *APIError {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr
	}
	return &APIError{
		Code:    ErrCodeInternalError,
		Message: err.Error(),
	}
}

func APIErrorToHTTPStatus(code ErrorCode) int {
	switch code {
	case ErrCodeInvalidRequest, ErrCodeValidationFailed:
		return http.StatusBadRequest
	case ErrCodeUnauthorized:
		return http.StatusUnauthorized
	case ErrCodeForbidden:
		return http.StatusForbidden
	case ErrCodeNotFound:
		return http.StatusNotFound
	case ErrCodeConflict:
		return http.StatusConflict
	case ErrCodeInternalError, ErrCodeServiceUnavailable:
		return http.StatusInternalServerError
	default:
		return http.StatusInternalServerError
	}
}
