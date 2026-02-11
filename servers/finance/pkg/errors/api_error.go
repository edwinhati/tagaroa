package errors

import (
	"encoding/json"
	"net/http"
	"time"
)

// ErrorCode represents a machine-readable error code
type ErrorCode string

// Standard error codes used across all services
const (
	ErrCodeValidationError    ErrorCode = "VALIDATION_ERROR"
	ErrCodeNotFound           ErrorCode = "NOT_FOUND"
	ErrCodeUnauthorized       ErrorCode = "UNAUTHORIZED"
	ErrCodeForbidden          ErrorCode = "FORBIDDEN"
	ErrCodeConflict           ErrorCode = "CONFLICT"
	ErrCodeInternalError      ErrorCode = "INTERNAL_ERROR"
	ErrCodeRateLimited        ErrorCode = "RATE_LIMITED"
	ErrCodeServiceUnavailable ErrorCode = "SERVICE_UNAVAILABLE"
	ErrCodeBadRequest         ErrorCode = "BAD_REQUEST"
)

// ErrorDetail contains the error information
type ErrorDetail struct {
	Code    ErrorCode   `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// MetaInfo contains request metadata
type MetaInfo struct {
	RequestID string `json:"requestId"`
	TraceID   string `json:"traceId,omitempty"`
	Timestamp string `json:"timestamp"`
	Service   string `json:"service"`
}

// ApiErrorResponse is the unified error response format
type ApiErrorResponse struct {
	Error ErrorDetail `json:"error"`
	Meta  MetaInfo    `json:"meta"`
}

// ApiError represents an API error with code and HTTP status
type ApiError struct {
	Code       ErrorCode
	StatusCode int
	Message    string
	Details    interface{}
}

// Error implements the error interface
func (e *ApiError) Error() string {
	return string(e.Code) + ": " + e.Message
}

// ToResponse converts the error to an ApiErrorResponse
func (e *ApiError) ToResponse(requestID, service, traceID string) ApiErrorResponse {
	return ApiErrorResponse{
		Error: ErrorDetail{
			Code:    e.Code,
			Message: e.Message,
			Details: e.Details,
		},
		Meta: MetaInfo{
			RequestID: requestID,
			TraceID:   traceID,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Service:   service,
		},
	}
}

// WriteErrorResponse writes an ApiErrorResponse to the http.ResponseWriter
func (e *ApiError) WriteErrorResponse(w http.ResponseWriter, requestID, service, traceID string) {
	response := e.ToResponse(requestID, service, traceID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(e.StatusCode)
	json.NewEncoder(w).Encode(response)
}

// ErrorCodeToHTTPStatus maps error codes to HTTP status codes
func ErrorCodeToHTTPStatus(code ErrorCode) int {
	switch code {
	case ErrCodeValidationError, ErrCodeBadRequest:
		return http.StatusBadRequest
	case ErrCodeUnauthorized:
		return http.StatusUnauthorized
	case ErrCodeForbidden:
		return http.StatusForbidden
	case ErrCodeNotFound:
		return http.StatusNotFound
	case ErrCodeConflict:
		return http.StatusConflict
	case ErrCodeRateLimited:
		return http.StatusTooManyRequests
	case ErrCodeServiceUnavailable:
		return http.StatusServiceUnavailable
	case ErrCodeInternalError:
		return http.StatusInternalServerError
	default:
		return http.StatusInternalServerError
	}
}

// New creates a new ApiError
func New(code ErrorCode, message string, details interface{}) *ApiError {
	return &ApiError{
		Code:       code,
		StatusCode: ErrorCodeToHTTPStatus(code),
		Message:    message,
		Details:    details,
	}
}

// NotFound creates a NOT_FOUND error
func NotFound(resource string) *ApiError {
	return New(ErrCodeNotFound, resource+" not found", nil)
}

// NotFoundWithID creates a NOT_FOUND error with ID
func NotFoundWithID(resource, id string) *ApiError {
	return New(ErrCodeNotFound, resource+" with id '"+id+"' not found", nil)
}

// Validation creates a VALIDATION_ERROR
func Validation(message string, details interface{}) *ApiError {
	return New(ErrCodeValidationError, message, details)
}

// Unauthorized creates an UNAUTHORIZED error
func Unauthorized(message string) *ApiError {
	if message == "" {
		message = "Authentication required"
	}
	return New(ErrCodeUnauthorized, message, nil)
}

// Forbidden creates a FORBIDDEN error
func Forbidden(message string) *ApiError {
	if message == "" {
		message = "Access denied"
	}
	return New(ErrCodeForbidden, message, nil)
}

// Internal creates an INTERNAL_ERROR
func Internal(message string) *ApiError {
	if message == "" {
		message = "An internal error occurred"
	}
	return New(ErrCodeInternalError, message, nil)
}

// RateLimited creates a RATE_LIMITED error
func RateLimited(message string) *ApiError {
	if message == "" {
		message = "Too many requests"
	}
	return New(ErrCodeRateLimited, message, nil)
}

// ServiceUnavailable creates a SERVICE_UNAVAILABLE error
func ServiceUnavailable(message string) *ApiError {
	if message == "" {
		message = "Service temporarily unavailable"
	}
	return New(ErrCodeServiceUnavailable, message, nil)
}

// Conflict creates a CONFLICT error
func Conflict(message string) *ApiError {
	return New(ErrCodeConflict, message, nil)
}

// FromError converts any error to ApiError
func FromError(err error) *ApiError {
	if err == nil {
		return nil
	}

	if apiErr, ok := err.(*ApiError); ok {
		return apiErr
	}

	return Internal(err.Error())
}

// WriteResponse is a helper function to write an error response
func WriteResponse(w http.ResponseWriter, code ErrorCode, message, requestID, service, traceID string) {
	apiErr := New(code, message, nil)
	apiErr.WriteErrorResponse(w, requestID, service, traceID)
}
