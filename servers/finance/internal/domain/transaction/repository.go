package transaction

import (
	"context"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/google/uuid"
)

// FindManyParams defines parameters for finding multiple transactions
type FindManyParams struct {
	UserID     shared.UserID
	Page       int
	Limit      int
	Types      []TransactionType
	Currencies []shared.Currency
	Accounts   []string // Account names (not UUIDs)
	Categories []string
	Search     string
	StartDate  *time.Time
	EndDate    *time.Time
	OrderBy    string
}

// AggregationResult represents aggregation query results
type AggregationResult struct {
	Count int     `json:"count"`
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
	Avg   float64 `json:"avg"`
	Sum   float64 `json:"sum"`
}

// FindManyResult contains paginated transactions with aggregations
type FindManyResult struct {
	Transactions         []*Transaction
	Total                int
	TypeAggregations     map[string]AggregationResult
	CurrencyAggregations map[string]AggregationResult
	AccountAggregations  map[string]AggregationResult
	CategoryAggregations map[string]AggregationResult
}

// Repository defines the port for Transaction persistence
type Repository interface {
	// FindByID finds a transaction by ID
	FindByID(ctx context.Context, id uuid.UUID) (*Transaction, error)

	// FindByUserID finds transactions for a user with filters
	FindMany(ctx context.Context, params FindManyParams) (*FindManyResult, error)

	// Save saves a new or existing transaction
	Save(ctx context.Context, transaction *Transaction) error

	// Delete soft-deletes a transaction
	Delete(ctx context.Context, id uuid.UUID) error

	// GetTypeAggregations aggregates transactions by type
	GetTypeAggregations(ctx context.Context, params FindManyParams) (map[string]AggregationResult, error)

	// GetCurrencyAggregations aggregates transactions by currency
	GetCurrencyAggregations(ctx context.Context, params FindManyParams) (map[string]AggregationResult, error)

	// GetAccountAggregations aggregates transactions by account
	GetAccountAggregations(ctx context.Context, params FindManyParams) (map[string]AggregationResult, error)

	// GetCategoryAggregations aggregates transactions by category
	GetCategoryAggregations(ctx context.Context, params FindManyParams) (map[string]AggregationResult, error)

	// Count returns the number of transactions for a user
	Count(ctx context.Context, params FindManyParams) (int, error)
}
