package http

import "time"

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
