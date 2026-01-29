package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
	sharedutil "github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/util"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type LiabilityRepository interface {
	Create(ctx context.Context, liability *model.Liability) error
	FindUnique(ctx context.Context, params sharedutil.FindUniqueParams) (*model.Liability, error)
	FindMany(ctx context.Context, params sharedutil.FindManyParams) ([]*model.Liability, error)
	Count(ctx context.Context, where map[string]any) (int, error)
	Update(ctx context.Context, liability *model.Liability) error
	SumByUserAndCurrency(ctx context.Context, userID uuid.UUID, currency string) (float64, error)
}

type liabilityRepository struct {
	db  *sql.DB
	log *zap.SugaredLogger
}

func NewLiabilityRepository(db *sql.DB) LiabilityRepository {
	return &liabilityRepository{
		db:  db,
		log: logger.New().With("repository", "liability"),
	}
}

const liabilitySelectCols = `id, name, type, amount, currency, user_id, paid_at, notes, deleted_at, created_at, updated_at`

func scanLiability(scanner sharedutil.RowScanner) (*model.Liability, error) {
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

func (r *liabilityRepository) FindUnique(ctx context.Context, params sharedutil.FindUniqueParams) (*model.Liability, error) {
	ctx, cancel := util.DBContext(ctx, util.DefaultTimeoutConfig)
	defer cancel()

	var sb strings.Builder
	sb.WriteString("SELECT " + liabilitySelectCols + " FROM liabilities")

	whereClause, args := sharedutil.BuildWhere(params.Where, sharedutil.WhereBuildOpts{
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

func (r *liabilityRepository) FindMany(ctx context.Context, params sharedutil.FindManyParams) ([]*model.Liability, error) {
	ctx, cancel := util.QueryContext(ctx, util.DefaultTimeoutConfig)
	defer cancel()

	var sb strings.Builder
	sb.WriteString("SELECT " + liabilitySelectCols + " FROM liabilities")

	whereClause, args := sharedutil.BuildWhere(params.Where, sharedutil.WhereBuildOpts{
		FieldOrder:     []string{"user_id", "type", "currency"},
		ExcludeDeleted: true,
	})
	sb.WriteString(whereClause)

	orderBy, err := sharedutil.ValidateOrderBy(params.OrderBy, liabilityAllowedOrderBy)
	if err != nil {
		return nil, fmt.Errorf("invalid ORDER BY: %w", err)
	}
	sb.WriteString(" ORDER BY " + orderBy)

	currIdx := len(args) + 1
	_, args = sharedutil.AddOffsetLimit(&sb, params.Offset, params.Limit, currIdx, args)

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
	ctx, cancel := util.QueryContext(ctx, util.DefaultTimeoutConfig)
	defer cancel()

	var sb strings.Builder
	sb.WriteString("SELECT COUNT(*) FROM liabilities")

	whereClause, args := sharedutil.BuildWhere(where, sharedutil.WhereBuildOpts{
		FieldOrder:     []string{"user_id", "type", "currency"},
		ExcludeDeleted: true,
	})
	sb.WriteString(whereClause)

	var count int
	err := r.db.QueryRowContext(ctx, sb.String(), args...).Scan(&count)
	return count, err
}

func (r *liabilityRepository) Update(ctx context.Context, liability *model.Liability) error {
	r.log.Debugw("Updating liability",
		"liability_id", liability.ID,
		"user_id", liability.UserID,
		"name", liability.Name,
		"type", liability.Type,
		"amount", liability.Amount,
		"paid_at", liability.PaidAt,
	)

	liability.UpdatedAt = time.Now()

	query := `UPDATE liabilities SET name = $2, type = $3, amount = $4, currency = $5,
		paid_at = $6, notes = $7, deleted_at = $8, updated_at = $9 WHERE id = $1`

	r.log.Debugw("Liability update query", "query", "liability_id", liability.ID)

	_, err := r.db.ExecContext(ctx, query,
		liability.ID, liability.Name, liability.Type, liability.Amount,
		liability.Currency, liability.PaidAt, liability.Notes, liability.DeletedAt, liability.UpdatedAt,
	)
	if err != nil {
		r.log.Errorw("Failed to update liability",
			"error", err,
			"liability_id", liability.ID,
			"user_id", liability.UserID,
		)
		return err
	}

	r.log.Infow("Liability updated",
		"liability_id", liability.ID,
		"user_id", liability.UserID,
		"name", liability.Name,
		"type", liability.Type,
		"amount", liability.Amount,
		"currency", liability.Currency,
	)

	return nil
}

func (r *liabilityRepository) SumByUserAndCurrency(ctx context.Context, userID uuid.UUID, currency string) (float64, error) {
	r.log.Debugw("Getting liabilities sum by user and currency",
		"user_id", userID,
		"currency", currency,
	)

	query := `SELECT COALESCE(SUM(amount), 0) FROM liabilities WHERE user_id = $1 AND currency = $2 AND deleted_at IS NULL AND paid_at IS NULL`

	r.log.Debugw("Liabilities sum query", "query", "user_id", userID, "currency", currency)

	var sum float64
	err := r.db.QueryRowContext(ctx, query, userID, currency).Scan(&sum)
	if err != nil {
		r.log.Errorw("Failed to get liabilities sum",
			"error", err,
			"user_id", userID,
			"currency", currency,
		)
		return 0, err
	}

	r.log.Debugw("Liabilities sum retrieved",
		"user_id", userID,
		"currency", currency,
		"sum", sum,
	)

	return sum, nil
}
