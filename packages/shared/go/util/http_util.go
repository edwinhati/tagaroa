package util

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
)

const (
	headerContentType = "Content-Type"
	headerJSONValue   = "application/json"
)

type contextKey string

const UserIDKey contextKey = "userID"

type ApiResponse[T any] struct {
	Timestamp    time.Time     `json:"timestamp"`
	Data         *T            `json:"data,omitempty"`
	Pagination   *Pagination   `json:"pagination,omitempty"`
	Aggregations *Aggregations `json:"aggregations,omitempty"`
	Error        string        `json:"error,omitempty"`
	Message      string        `json:"message,omitempty"`
}

type Aggregations map[string][]Bucket

type Bucket struct {
	Key   string  `json:"key"`
	Count int     `json:"count"`
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
	Avg   float64 `json:"avg"`
	Sum   float64 `json:"sum"`
}

type Pagination struct {
	Page       int  `json:"page"`
	Limit      int  `json:"limit"`
	Offset     int  `json:"offset"`
	Total      int  `json:"total"`
	TotalPages int  `json:"total_pages"`
	HasNext    bool `json:"has_next"`
	HasPrev    bool `json:"has_prev"`
}

type ListResponse[T any] struct {
	Items []T `json:"items"`
}

type HealthResponse struct {
	Status string `json:"status"`
	Host   string `json:"host"`
	Time   string `json:"time"`
}

// NewListResponse creates a new ListResponse with just items
func NewListResponse[T any](items []T) ListResponse[T] {
	return ListResponse[T]{
		Items: items,
	}
}

// NewPagination creates a new Pagination struct with calculated values
func NewPagination(page, limit, total int) Pagination {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}

	offset := (page - 1) * limit
	totalPages := (total + limit - 1) / limit // Ceiling division
	hasNext := page < totalPages
	hasPrev := page > 1

	return Pagination{
		Page:       page,
		Limit:      limit,
		Offset:     offset,
		Total:      total,
		TotalPages: totalPages,
		HasNext:    hasNext,
		HasPrev:    hasPrev,
	}
}

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

func RequireUserID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	userID, err := userIDFromContext(r.Context())
	if err != nil {
		WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized", "Unable to determine user identity")
		return uuid.Nil, false
	}

	return userID, true
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

func userIDFromContext(ctx context.Context) (uuid.UUID, error) {
	raw, ok := ctx.Value(UserIDKey).(string)

	if !ok || raw == "" {
		return uuid.Nil, errors.New("user id missing from context")
	}

	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid user id: %w", err)
	}

	return id, nil
}
