package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/google/uuid"
)

type AssetRepository interface {
	Create(ctx context.Context, asset *model.Asset) error
	FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Asset, error)
	FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Asset, error)
	Count(ctx context.Context, where map[string]any) (int, error)
	Update(ctx context.Context, asset *model.Asset) error
	SumByUserAndCurrency(ctx context.Context, userID uuid.UUID, currency string) (float64, error)
}

type assetRepository struct {
	db *sql.DB
}

func NewAssetRepository(db *sql.DB) AssetRepository {
	return &assetRepository{db: db}
}

const assetSelectCols = `id, name, type, value, shares, ticker, currency, user_id, notes, deleted_at, created_at, updated_at`

func scanAsset(scanner util.RowScanner) (*model.Asset, error) {
	var asset model.Asset
	var deletedAt sql.NullTime
	var shares sql.NullFloat64
	var ticker sql.NullString

	if err := scanner.Scan(
		&asset.ID, &asset.Name, &asset.Type, &asset.Value,
		&shares, &ticker, &asset.Currency, &asset.UserID,
		&asset.Notes, &deletedAt, &asset.CreatedAt, &asset.UpdatedAt,
	); err != nil {
		return nil, err
	}

	if deletedAt.Valid {
		asset.DeletedAt = &deletedAt.Time
	}
	if shares.Valid {
		asset.Shares = &shares.Float64
	}
	if ticker.Valid {
		asset.Ticker = &ticker.String
	}

	return &asset, nil
}

var assetAllowedOrderBy = map[string]bool{
	"id": true, "name": true, "type": true, "value": true,
	"currency": true, "created_at": true, "updated_at": true,
}

func (r *assetRepository) Create(ctx context.Context, asset *model.Asset) error {
	if asset.ID == uuid.Nil {
		asset.ID = uuid.New()
	}
	now := time.Now()
	asset.CreatedAt = now
	asset.UpdatedAt = now

	query := `INSERT INTO assets (id, name, type, value, shares, ticker, currency, user_id, notes, deleted_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

	_, err := r.db.ExecContext(ctx, query,
		asset.ID, asset.Name, asset.Type, asset.Value, asset.Shares, asset.Ticker,
		asset.Currency, asset.UserID, asset.Notes, asset.DeletedAt, asset.CreatedAt, asset.UpdatedAt,
	)
	return err
}

func (r *assetRepository) FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Asset, error) {
	var sb strings.Builder
	sb.WriteString("SELECT " + assetSelectCols + " FROM assets")

	whereClause, args := util.BuildWhere(params.Where, util.WhereBuildOpts{
		FieldOrder:     []string{"user_id", "type", "currency"},
		ExcludeDeleted: true,
	})
	sb.WriteString(whereClause)
	sb.WriteString(" LIMIT 1")

	asset, err := scanAsset(r.db.QueryRowContext(ctx, sb.String(), args...))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return asset, err
}

func (r *assetRepository) FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Asset, error) {
	var sb strings.Builder
	sb.WriteString("SELECT " + assetSelectCols + " FROM assets")

	whereClause, args := util.BuildWhere(params.Where, util.WhereBuildOpts{
		FieldOrder:     []string{"user_id", "type", "currency"},
		ExcludeDeleted: true,
	})
	sb.WriteString(whereClause)

	orderBy, err := util.ValidateOrderBy(params.OrderBy, assetAllowedOrderBy)
	if err != nil {
		return nil, fmt.Errorf("invalid ORDER BY: %w", err)
	}
	sb.WriteString(" ORDER BY " + orderBy)

	currIdx := len(args) + 1
	_, args = util.AddOffsetLimit(&sb, params.Offset, params.Limit, currIdx, args)

	rows, err := r.db.QueryContext(ctx, sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assets []*model.Asset
	for rows.Next() {
		asset, err := scanAsset(rows)
		if err != nil {
			return nil, err
		}
		assets = append(assets, asset)
	}
	return assets, rows.Err()
}

func (r *assetRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	var sb strings.Builder
	sb.WriteString("SELECT COUNT(*) FROM assets")

	whereClause, args := util.BuildWhere(where, util.WhereBuildOpts{
		FieldOrder:     []string{"user_id", "type", "currency"},
		ExcludeDeleted: true,
	})
	sb.WriteString(whereClause)

	var count int
	err := r.db.QueryRowContext(ctx, sb.String(), args...).Scan(&count)
	return count, err
}

func (r *assetRepository) Update(ctx context.Context, asset *model.Asset) error {
	asset.UpdatedAt = time.Now()

	query := `UPDATE assets SET name = $2, type = $3, value = $4, shares = $5, ticker = $6,
		currency = $7, notes = $8, deleted_at = $9, updated_at = $10 WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query,
		asset.ID, asset.Name, asset.Type, asset.Value, asset.Shares, asset.Ticker,
		asset.Currency, asset.Notes, asset.DeletedAt, asset.UpdatedAt,
	)
	return err
}

func (r *assetRepository) SumByUserAndCurrency(ctx context.Context, userID uuid.UUID, currency string) (float64, error) {
	query := `SELECT COALESCE(SUM(value), 0) FROM assets WHERE user_id = $1 AND currency = $2 AND deleted_at IS NULL`
	var sum float64
	err := r.db.QueryRowContext(ctx, query, userID, currency).Scan(&sum)
	return sum, err
}
