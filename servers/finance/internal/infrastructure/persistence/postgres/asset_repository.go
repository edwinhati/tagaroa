package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/investment"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/logger"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// AssetRepository implements investment.AssetRepository for PostgreSQL
type AssetRepository struct {
	db  *sql.DB
	log *zap.SugaredLogger
}

// NewAssetRepository creates a new asset repository
func NewAssetRepository(db *sql.DB) *AssetRepository {
	return &AssetRepository{
		db:  db,
		log: logger.New().With("repository", "asset"),
	}
}

const assetSelectCols = `
	id, name, type, value, currency, user_id, purchase_date, notes, deleted_at, created_at, updated_at, version
`

// FindByID finds an asset by ID
func (r *AssetRepository) FindByID(ctx context.Context, id string) (*investment.Asset, error) {
	query := fmt.Sprintf("SELECT %s FROM assets WHERE id = $1 AND deleted_at IS NULL", assetSelectCols)

	var asset assetModel
	var deletedAt sql.NullTime
	var purchaseDate sql.NullTime
	var notes sql.NullString
	var version int

	exec := GetExecutor(ctx, r.db)
	err := exec.QueryRowContext(ctx, query, id).Scan(
		&asset.ID, &asset.Name, &asset.Type, &asset.Value,
		&asset.Currency, &asset.UserID, &purchaseDate, &notes,
		&deletedAt, &asset.CreatedAt, &asset.UpdatedAt, &version,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.Errorw("Failed to find asset", "error", err, "id", id)
		return nil, fmt.Errorf("failed to find asset: %w", err)
	}

	if deletedAt.Valid {
		asset.DeletedAt = &deletedAt.Time
	}
	if purchaseDate.Valid {
		asset.PurchaseDate = &purchaseDate.Time
	}
	if notes.Valid {
		asset.Notes = &notes.String
	}

	return r.toDomain(asset, version)
}

// FindByUserID finds all assets for a user
func (r *AssetRepository) FindByUserID(ctx context.Context, userID shared.UserID) ([]*investment.Asset, error) {
	query := fmt.Sprintf("SELECT %s FROM assets WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC", assetSelectCols)

	exec := GetExecutor(ctx, r.db)
	rows, err := exec.QueryContext(ctx, query, userID.String())
	if err != nil {
		r.log.Errorw("Failed to find assets", "error", err, "user_id", userID)
		return nil, fmt.Errorf("failed to find assets: %w", err)
	}
	defer rows.Close()

	var assets []*investment.Asset
	for rows.Next() {
		var asset assetModel
		var deletedAt sql.NullTime
		var purchaseDate sql.NullTime
		var notes sql.NullString
		var version int

		if err := rows.Scan(
			&asset.ID, &asset.Name, &asset.Type, &asset.Value,
			&asset.Currency, &asset.UserID, &purchaseDate, &notes,
			&deletedAt, &asset.CreatedAt, &asset.UpdatedAt, &version,
		); err != nil {
			return nil, fmt.Errorf("failed to scan asset: %w", err)
		}

		if deletedAt.Valid {
			asset.DeletedAt = &deletedAt.Time
		}
		if purchaseDate.Valid {
			asset.PurchaseDate = &purchaseDate.Time
		}
		if notes.Valid {
			asset.Notes = &notes.String
		}

		domainAsset, err := r.toDomain(asset, version)
		if err != nil {
			return nil, fmt.Errorf("failed to convert to domain: %w", err)
		}

		assets = append(assets, domainAsset)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating assets: %w", err)
	}

	return assets, nil
}

// Save saves a new or existing asset
func (r *AssetRepository) Save(ctx context.Context, asset *investment.Asset) error {
	isNew := asset.CreatedAt().IsZero() || asset.CreatedAt() == asset.UpdatedAt()

	if isNew {
		return r.create(ctx, asset)
	}
	return r.update(ctx, asset)
}

func (r *AssetRepository) create(ctx context.Context, asset *investment.Asset) error {
	query := `
		INSERT INTO assets (id, name, type, value, currency, user_id, purchase_date, notes, deleted_at, created_at, updated_at, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	now := time.Now()
	deletedAt := asset.DeletedAt()
	notes := asset.Notes()

	exec := GetExecutor(ctx, r.db)
	_, err := exec.ExecContext(ctx, query,
		asset.ID().String(),
		asset.Name(),
		asset.Type(),
		asset.Value(),
		string(asset.Currency()),
		asset.UserID().String(),
		asset.PurchaseDate(),
		notes,
		deletedAt,
		now,
		now,
		1,
	)
	if err != nil {
		r.log.Errorw("Failed to create asset", "error", err, "id", asset.ID())
		return fmt.Errorf("failed to create asset: %w", err)
	}

	r.log.Infow("Asset created", "id", asset.ID(), "user_id", asset.UserID())
	return nil
}

func (r *AssetRepository) update(ctx context.Context, asset *investment.Asset) error {
	query := `
		UPDATE assets
		SET name = $2, value = $3, notes = $4, deleted_at = $5, updated_at = $6, version = version + 1
		WHERE id = $1 AND version = $7
	`

	now := time.Now()
	deletedAt := asset.DeletedAt()
	notes := asset.Notes()

	exec := GetExecutor(ctx, r.db)
	result, err := exec.ExecContext(ctx, query,
		asset.ID().String(),
		asset.Name(),
		asset.Value(),
		notes,
		deletedAt,
		now,
		asset.Version(),
	)
	if err != nil {
		r.log.Errorw("Failed to update asset", "error", err, "id", asset.ID())
		return fmt.Errorf("failed to update asset: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("asset not found or version mismatch")
	}

	r.log.Debugw("Asset updated", "id", asset.ID())
	return nil
}

// Delete soft-deletes an asset
func (r *AssetRepository) Delete(ctx context.Context, id string) error {
	query := `UPDATE assets SET deleted_at = $1, updated_at = $1 WHERE id = $2`

	now := time.Now()
	exec := GetExecutor(ctx, r.db)
	result, err := exec.ExecContext(ctx, query, now, id)
	if err != nil {
		r.log.Errorw("Failed to delete asset", "error", err, "id", id)
		return fmt.Errorf("failed to delete asset: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("asset not found")
	}

	r.log.Infow("Asset deleted", "id", id)
	return nil
}

// Count returns the number of assets for a user
func (r *AssetRepository) Count(ctx context.Context, userID shared.UserID) (int, error) {
	query := `SELECT COUNT(*) FROM assets WHERE user_id = $1 AND deleted_at IS NULL`

	var count int
	exec := GetExecutor(ctx, r.db)
	err := exec.QueryRowContext(ctx, query, userID.String()).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count assets: %w", err)
	}

	return count, nil
}

// assetModel represents the database model for assets
type assetModel struct {
	ID           uuid.UUID
	Name         string
	Type         investment.AssetType
	Value        float64
	Currency     string
	UserID       string
	PurchaseDate *time.Time
	Notes        *string
	DeletedAt    *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// toDomain converts a database model to a domain aggregate
func (r *AssetRepository) toDomain(m assetModel, version int) (*investment.Asset, error) {
	userID, err := shared.UserIDFromString(m.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %w", err)
	}

	currency := shared.Currency(m.Currency)
	if !currency.IsValid() {
		return nil, fmt.Errorf("invalid currency: %s", m.Currency)
	}

	return investment.RestoreAsset(
		m.ID,
		m.Name,
		m.Type,
		m.Value,
		currency,
		userID,
		m.PurchaseDate,
		m.Notes,
		m.DeletedAt,
		m.CreatedAt,
		m.UpdatedAt,
		version,
	), nil
}
