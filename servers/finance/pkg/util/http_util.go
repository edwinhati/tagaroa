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
	"go.opentelemetry.io/otel/trace"
)

const (
	headerContentType       = "Content-Type"
	headerJSONValue         = "application/json"
	headerJSONApiValue      = "application/vnd.api+json"
)

type contextKey string

const (
	UserIDKey    contextKey = "userID"
	RequestIDKey contextKey = "requestID"
)

// ApiResponse is the legacy response structure.
// Deprecated: Use JsonApiResponse for JSON:API compliant responses.
type ApiResponse[T any] struct {
	Timestamp    time.Time     `json:"timestamp"`
	Data         *T            `json:"data,omitempty"`
	Pagination   *Pagination   `json:"pagination,omitempty"`
	Aggregations *Aggregations `json:"aggregations,omitempty"`
	Error        string        `json:"error,omitempty"`
	Message      string        `json:"message,omitempty"`
}

// JsonApiResponse is a JSON:API compliant response structure.
// See: https://jsonapi.org/format/
type JsonApiResponse[T any] struct {
	Data    T                `json:"data"`
	Meta    *JsonApiMeta     `json:"meta,omitempty"`
	JsonApi *JsonApiVersion  `json:"jsonapi,omitempty"`
	Links   *JsonApiLinks    `json:"links,omitempty"`
	Errors  []JsonApiError   `json:"errors,omitempty"`
}

// JsonApiMeta contains metadata about the response.
type JsonApiMeta struct {
	Pagination   *Pagination               `json:"pagination,omitempty"`
	Aggregations *Aggregations             `json:"aggregations,omitempty"`
	Timestamp    time.Time                 `json:"timestamp,omitempty"`
	Message      string                    `json:"message,omitempty"`
	RequestID    string                    `json:"requestId,omitempty"`
	TraceID      string                    `json:"traceId,omitempty"`
}

// JsonApiVersion specifies the JSON:API version.
type JsonApiVersion struct {
	Version string `json:"version"`
}

// JsonApiLinks contains links for pagination and navigation.
type JsonApiLinks struct {
	Self  string `json:"self,omitempty"`
	First string `json:"first,omitempty"`
	Last  string `json:"last,omitempty"`
	Next  string `json:"next,omitempty"`
	Prev  string `json:"prev,omitempty"`
}

// JsonApiError represents a JSON:API error object.
// See: https://jsonapi.org/format/#error-objects
type JsonApiError struct {
	ID     string                 `json:"id,omitempty"`
	Status string                 `json:"status"`
	Code   string                 `json:"code"`
	Title  string                 `json:"title"`
	Detail string                 `json:"detail"`
	Meta   map[string]interface{} `json:"meta,omitempty"`
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

// WriteErrorResponseWithTrace writes a JSON error response with trace context
func WriteErrorResponseWithTrace(w http.ResponseWriter, r *http.Request, statusCode int, errorCode, message string, service string) {
	w.Header().Set(headerContentType, headerJSONValue)
	w.WriteHeader(statusCode)

	requestID := GetRequestID(r)
	traceID := GetTraceID(r)

	response := ApiResponse[string]{
		Timestamp: time.Now(),
		Error:     errorCode,
		Message:   message,
	}

	// Wrap response with trace context metadata
	wrapped := struct {
		ApiResponse[string]
		Meta struct {
			RequestID string `json:"requestId,omitempty"`
			TraceID   string `json:"traceId,omitempty"`
			Service   string `json:"service,omitempty"`
		} `json:"meta,omitempty"`
	}{
		ApiResponse: response,
	}
	wrapped.Meta.RequestID = requestID
	wrapped.Meta.TraceID = traceID
	wrapped.Meta.Service = service

	json.NewEncoder(w).Encode(wrapped)
}

// GetRequestID retrieves the request ID from the request context
func GetRequestID(r *http.Request) string {
	if requestID, ok := r.Context().Value(RequestIDKey).(string); ok {
		return requestID
	}
	return ""
}

// GetTraceID retrieves the trace ID from the OpenTelemetry span context
func GetTraceID(r *http.Request) string {
	span := trace.SpanFromContext(r.Context())
	if span.SpanContext().IsValid() {
		return span.SpanContext().TraceID().String()
	}
	return ""
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

// WriteJsonApiResponse writes a JSON:API compliant response.
func WriteJsonApiResponse[T any](w http.ResponseWriter, r *http.Request, statusCode int, data T, meta JsonApiMeta, links *JsonApiLinks) {
	w.Header().Set(headerContentType, headerJSONApiValue)
	w.WriteHeader(statusCode)

	response := JsonApiResponse[T]{
		Data:    data,
		Meta:    &meta,
		JsonApi: &JsonApiVersion{Version: "1.0"},
		Links:   links,
	}

	_ = json.NewEncoder(w).Encode(response)
}

// WriteJsonApiError writes a JSON:API compliant error response.
func WriteJsonApiError(w http.ResponseWriter, r *http.Request, statusCode int, code, title, detail string) {
	w.Header().Set(headerContentType, headerJSONApiValue)
	w.WriteHeader(statusCode)

	response := JsonApiResponse[struct{}]{
		Errors: []JsonApiError{{
			Status: strconv.Itoa(statusCode),
			Code:   code,
			Title:  title,
			Detail: detail,
		}},
		JsonApi: &JsonApiVersion{Version: "1.0"},
	}

	_ = json.NewEncoder(w).Encode(response)
}

// WriteJsonApiListResponse writes a JSON:API compliant list response with pagination and aggregations.
func WriteJsonApiListResponse[T any](w http.ResponseWriter, r *http.Request, statusCode int, items []T, pagination Pagination, aggregations *Aggregations, message string) {
	// Build links from the request
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	baseURL := scheme + "://" + r.Host + r.URL.Path

	links := &JsonApiLinks{
		Self: buildPageURL(baseURL, pagination.Page, pagination.Limit),
	}

	if pagination.HasPrev {
		links.Prev = buildPageURL(baseURL, pagination.Page-1, pagination.Limit)
		links.First = buildPageURL(baseURL, 1, pagination.Limit)
	}
	if pagination.HasNext {
		links.Next = buildPageURL(baseURL, pagination.Page+1, pagination.Limit)
		links.Last = buildPageURL(baseURL, pagination.TotalPages, pagination.Limit)
	}

	meta := JsonApiMeta{
		Pagination:   &pagination,
		Aggregations: aggregations,
		Timestamp:    time.Now(),
		Message:      message,
		RequestID:    GetRequestID(r),
		TraceID:      GetTraceID(r),
	}

	WriteJsonApiResponse(w, r, statusCode, items, meta, links)
}

// buildPageURL builds a URL with pagination query parameters.
func buildPageURL(baseURL string, page, limit int) string {
	return fmt.Sprintf("%s?page=%d&limit=%d", baseURL, page, limit)
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
