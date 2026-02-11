package budget

import (
	"context"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
)

// Repository defines the port for Budget persistence
type Repository interface {
	// FindByID finds a budget by ID
	FindByID(ctx context.Context, id string) (*Budget, error)

	// FindByMonthYear finds a budget by user, month, and year
	FindByMonthYear(ctx context.Context, userID shared.UserID, month, year int) (*Budget, error)

	// FindByUser finds all budgets for a user
	FindByUser(ctx context.Context, userID shared.UserID) ([]*Budget, error)

	// Save saves a new or existing budget
	Save(ctx context.Context, budget *Budget) error

	// Delete soft-deletes a budget
	Delete(ctx context.Context, id string) error

	// Exists checks if a budget exists for user, month, and year
	Exists(ctx context.Context, userID shared.UserID, month, year int) (bool, error)

	// Count returns the number of budgets for a user
	Count(ctx context.Context, userID shared.UserID) (int, error)
}
