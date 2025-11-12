package http

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
)

const (
	headerContentType = "Content-Type"
	headerJSONValue   = "application/json"
)

// WriteJSONResponse writes a JSON response with the given status code and data
func WriteJSONResponse[T any](w http.ResponseWriter, statusCode int, data *T, message string) {
	w.Header().Set(headerContentType, headerJSONValue)
	w.WriteHeader(statusCode)

	response := ApiResponse[T]{
		Timestamp: time.Now(),
		Data:      data,
		Message:   message,
	}

	json.NewEncoder(w).Encode(response)
}

// WriteErrorResponse writes a JSON error response
func WriteErrorResponse(w http.ResponseWriter, statusCode int, error, message string) {
	w.Header().Set(headerContentType, headerJSONValue)
	w.WriteHeader(statusCode)

	response := ApiResponse[string]{
		Timestamp: time.Now(),
		Error:     error,
		Message:   message,
	}

	json.NewEncoder(w).Encode(response)
}

// ParseUUID parses a UUID from a string and writes an error response if invalid
func ParseUUID(w http.ResponseWriter, idStr string) (uuid.UUID, bool) {
	id, err := uuid.Parse(idStr)
	if err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid ID", err.Error())
		return uuid.Nil, false
	}
	return id, true
}

// ParseJSONBody parses JSON request body and writes an error response if invalid
func ParseJSONBody[T any](w http.ResponseWriter, r *http.Request, dest *T) bool {
	if err := json.NewDecoder(r.Body).Decode(dest); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return false
	}
	return true
}

// GetQueryInt gets an integer query parameter with a default value
func GetQueryInt(r *http.Request, key string, defaultValue int) int {
	value := r.URL.Query().Get(key)
	if value == "" {
		return defaultValue
	}

	intValue, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}

	return intValue
}

// GetPathParam gets a path parameter from the URL
func GetPathParam(r *http.Request, key string) string {
	return r.PathValue(key)
}

// WritePaginatedJSONResponse writes a JSON response with pagination
func WritePaginatedJSONResponse[T any](w http.ResponseWriter, statusCode int, items []T, pagination Pagination, message string) {
	w.Header().Set(headerContentType, headerJSONValue)
	w.WriteHeader(statusCode)

	response := ApiResponse[[]T]{
		Timestamp:  time.Now(),
		Data:       &items,
		Pagination: &pagination,
		Message:    message,
	}

	json.NewEncoder(w).Encode(response)
}

// WriteListResponse writes a JSON response with pagination and optional aggregations
func WriteListResponse[T any](w http.ResponseWriter, statusCode int, items []T, pagination Pagination, aggregations *Aggregations, message string) {
	w.Header().Set(headerContentType, headerJSONValue)
	w.WriteHeader(statusCode)

	response := ApiResponse[[]T]{
		Timestamp:    time.Now(),
		Data:         &items,
		Pagination:   &pagination,
		Aggregations: aggregations,
		Message:      message,
	}

	json.NewEncoder(w).Encode(response)
}
