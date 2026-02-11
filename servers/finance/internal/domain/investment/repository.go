package investment

import (
	"context"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
)

// AssetRepository defines the port for Asset persistence
type AssetRepository interface {
	// FindByID finds an asset by ID
	FindByID(ctx context.Context, id string) (*Asset, error)

	// FindByUserID finds all assets for a user
	FindByUserID(ctx context.Context, userID shared.UserID) ([]*Asset, error)

	// Save saves a new or existing asset
	Save(ctx context.Context, asset *Asset) error

	// Delete soft-deletes an asset
	Delete(ctx context.Context, id string) error

	// Count returns the number of assets for a user
	Count(ctx context.Context, userID shared.UserID) (int, error)
}

// LiabilityRepository defines the port for Liability persistence
type LiabilityRepository interface {
	// FindByID finds a liability by ID
	FindByID(ctx context.Context, id string) (*Liability, error)

	// FindByUserID finds all liabilities for a user
	FindByUserID(ctx context.Context, userID shared.UserID) ([]*Liability, error)

	// Save saves a new or existing liability
	Save(ctx context.Context, liability *Liability) error

	// Delete soft-deletes a liability
	Delete(ctx context.Context, id string) error

	// Count returns the number of liabilities for a user
	Count(ctx context.Context, userID shared.UserID) (int, error)
}

// NetWorthRepository defines the port for NetWorth queries
type NetWorthRepository interface {
	// Calculate calculates the net worth for a user
	Calculate(ctx context.Context, userID shared.UserID, currency shared.Currency) (*NetWorth, error)

	// GetHistory retrieves historical net worth data
	GetHistory(ctx context.Context, userID shared.UserID, currency shared.Currency, limit int) ([]*NetWorth, error)
}
