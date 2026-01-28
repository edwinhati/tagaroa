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

type LiabilityRepository interface {
	Create(ctx context.Context, liability *model.Liability) error
	FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Liability, error)
	FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Liability, error)
	Count(ctx context.Context, where map[string]any) (int, error)
	Update(ctx context.Context, liability *model.Liability) error
	SumByUserAndCurrency(ctx context.Context, userID uuid.UUID, currency string) (float64, error)
}

type liabilityRepository struct {
	db *sql.DB
}

func NewLiabilityRepository(db *sql.DB) LiabilityRepository {
	return &liabilityRepository{db: db}
}

const liabilitySelectCols = `id, name, type, amount, currency, user_id, paid_at, notes, deleted_at, created_at, updated_at`

func scanLiability(scanner util.RowScanner) (*model.Liability, error) {
	var liability model.Liability
	var deletedAt, paidAt sql.NullTime

	if err := scanner.Scan(
		&liability.ID, &liability.Name, &liability.Type, &liability.Amount,
		&liability.Currency, &liability.UserID, &paidAt, &liability.Notes,
		&deletedAt, &liability.CreatedAt, &liability.UpdatedAt,
	); err != nil {
		return nil, err
	}

	if deletedAt.Valid {
		liability.DeletedAt = &deletedAt.Time
	}
	if paidAt.Valid {
		liability.PaidAt = &paidAt.Time
	}

	return &liability, nil
}

var liabilityAllowedOrderBy = map[string]bool{
	"id": true, "name": true, "type": true, "amount": true,
	"currency": true, "paid_at": true, "created_at": true, "updated_at": true,
}

func (r *liabilityRepository) Create(ctx context.Context, liability *model.Liability) error {
	if liability.ID == uuid.Nil {
		liability.ID = uuid.New()
	}
	now := time.Now()
	liability.CreatedAt = now
	liability.UpdatedAt = now

	query := `INSERT INTO liabilities (id, name, type, amount, currency, user_id, paid_at, notes, deleted_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`

	_, err := r.db.ExecContext(ctx, query,
		liability.ID, liability.Name, liability.Type, liability.Amount,
		liability.Currency, liability.UserID, liability.PaidAt, liability.Notes,
		liability.DeletedAt, liability.CreatedAt, liability.UpdatedAt,
	)
	return err
}

func (r *liabilityRepository) FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Liability, error) {
	var sb strings.Builder
	sb.WriteString("SELECT " + liabilitySelectCols + " FROM liabilities")

	whereClause, args := util.BuildWhere(params.Where, util.WhereBuildOpts{
		FieldOrder:     []string{"user_id", "type", "currency"},
		ExcludeDeleted: true,
	})
	sb.WriteString(whereClause)
	sb.WriteString(" LIMIT 1")

	liability, err := scanLiability(r.db.QueryRowContext(ctx, sb.String(), args...))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return liability, err
}

func (r *liabilityRepository) FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Liability, error) {
	var sb strings.Builder
	sb.WriteString("SELECT " + liabilitySelectCols + " FROM liabilities")

	whereClause, args := util.BuildWhere(params.Where, util.WhereBuildOpts{
		FieldOrder:     []string{"user_id", "type", "currency"},
		ExcludeDeleted: true,
	})
	sb.WriteString(whereClause)

	orderBy, err := util.ValidateOrderBy(params.OrderBy, liabilityAllowedOrderBy)
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

	var liabilities []*model.Liability
	for rows.Next() {
		liability, err := scanLiability(rows)
		if err != nil {
			return nil, err
		}
		liabilities = append(liabilities, liability)
	}
	return liabilities, rows.Err()
}

func (r *liabilityRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	var sb strings.Builder
	sb.WriteString("SELECT COUNT(*) FROM liabilities")

	whereClause, args := util.BuildWhere(where, util.WhereBuildOpts{
		FieldOrder:     []string{"user_id", "type", "currency"},
		ExcludeDeleted: true,
	})
	sb.WriteString(whereClause)

	var count int
	err := r.db.QueryRowContext(ctx, sb.String(), args...).Scan(&count)
	return count, err
}

func (r *liabilityRepository) Update(ctx context.Context, liability *model.Liability) error {
	liability.UpdatedAt = time.Now()

	query := `UPDATE liabilities SET name = $2, type = $3, amount = $4, currency = $5,
		paid_at = $6, notes = $7, deleted_at = $8, updated_at = $9 WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query,
		liability.ID, liability.Name, liability.Type, liability.Amount,
		liability.Currency, liability.PaidAt, liability.Notes, liability.DeletedAt, liability.UpdatedAt,
	)
	return err
}

func (r *liabilityRepository) SumByUserAndCurrency(ctx context.Context, userID uuid.UUID, currency string) (float64, error) {
	query := `SELECT COALESCE(SUM(amount), 0) FROM liabilities WHERE user_id = $1 AND currency = $2 AND deleted_at IS NULL AND paid_at IS NULL`
	var sum float64
	err := r.db.QueryRowContext(ctx, query, userID, currency).Scan(&sum)
	return sum, err
}
