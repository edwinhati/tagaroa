package account

import (
	"context"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/google/uuid"
)

// Repository defines the port for Account persistence
type Repository interface {
	// FindByID finds an account by ID
	FindByID(ctx context.Context, id uuid.UUID) (*Account, error)

	// FindByUserID finds all accounts for a user
	FindByUserID(ctx context.Context, userID shared.UserID) ([]*Account, error)

	// Save saves a new or existing account
	Save(ctx context.Context, account *Account) error

	// Delete soft-deletes an account
	Delete(ctx context.Context, id uuid.UUID) error

	// Exists checks if an account exists for a user
	Exists(ctx context.Context, userID shared.UserID, name string) (bool, error)

	// Count returns the number of accounts for a user
	Count(ctx context.Context, userID shared.UserID) (int, error)
}
