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

// LiabilityRepository implements investment.LiabilityRepository for PostgreSQL
type LiabilityRepository struct {
	db  *sql.DB
	log *zap.SugaredLogger
}

// NewLiabilityRepository creates a new liability repository
func NewLiabilityRepository(db *sql.DB) *LiabilityRepository {
	return &LiabilityRepository{
		db:  db,
		log: logger.New().With("repository", "liability"),
	}
}

const liabilitySelectCols = `
	id, name, type, amount, remaining_amount, currency, user_id, interest_rate, due_date, notes, deleted_at, created_at, updated_at, version
`

// FindByID finds a liability by ID
func (r *LiabilityRepository) FindByID(ctx context.Context, id string) (*investment.Liability, error) {
	query := fmt.Sprintf("SELECT %s FROM liabilities WHERE id = $1 AND deleted_at IS NULL", liabilitySelectCols)

	var liability liabilityModel
	var deletedAt sql.NullTime
	var dueDate sql.NullTime
	var interestRate sql.NullFloat64
	var notes sql.NullString
	var version int

	exec := GetExecutor(ctx, r.db)
	err := exec.QueryRowContext(ctx, query, id).Scan(
		&liability.ID, &liability.Name, &liability.Type, &liability.Amount,
		&liability.RemainingAmount, &liability.Currency, &liability.UserID,
		&interestRate, &dueDate, &notes, &deletedAt,
		&liability.CreatedAt, &liability.UpdatedAt, &version,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.Errorw("Failed to find liability", "error", err, "id", id)
		return nil, fmt.Errorf("failed to find liability: %w", err)
	}

	if deletedAt.Valid {
		liability.DeletedAt = &deletedAt.Time
	}
	if dueDate.Valid {
		liability.DueDate = &dueDate.Time
	}
	if interestRate.Valid {
		liability.InterestRate = &interestRate.Float64
	}
	if notes.Valid {
		liability.Notes = &notes.String
	}

	return r.toDomain(liability, version)
}

// FindByUserID finds all liabilities for a user
func (r *LiabilityRepository) FindByUserID(ctx context.Context, userID shared.UserID) ([]*investment.Liability, error) {
	query := fmt.Sprintf("SELECT %s FROM liabilities WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC", liabilitySelectCols)

	exec := GetExecutor(ctx, r.db)
	rows, err := exec.QueryContext(ctx, query, userID.String())
	if err != nil {
		r.log.Errorw("Failed to find liabilities", "error", err, "user_id", userID)
		return nil, fmt.Errorf("failed to find liabilities: %w", err)
	}
	defer rows.Close()

	var liabilities []*investment.Liability
	for rows.Next() {
		var liability liabilityModel
		var deletedAt sql.NullTime
		var dueDate sql.NullTime
		var interestRate sql.NullFloat64
		var notes sql.NullString
		var version int

		if err := rows.Scan(
			&liability.ID, &liability.Name, &liability.Type, &liability.Amount,
			&liability.RemainingAmount, &liability.Currency, &liability.UserID,
			&interestRate, &dueDate, &notes, &deletedAt,
			&liability.CreatedAt, &liability.UpdatedAt, &version,
		); err != nil {
			return nil, fmt.Errorf("failed to scan liability: %w", err)
		}

		if deletedAt.Valid {
			liability.DeletedAt = &deletedAt.Time
		}
		if dueDate.Valid {
			liability.DueDate = &dueDate.Time
		}
		if interestRate.Valid {
			liability.InterestRate = &interestRate.Float64
		}
		if notes.Valid {
			liability.Notes = &notes.String
		}

		domainLiability, err := r.toDomain(liability, version)
		if err != nil {
			return nil, fmt.Errorf("failed to convert to domain: %w", err)
		}

		liabilities = append(liabilities, domainLiability)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating liabilities: %w", err)
	}

	return liabilities, nil
}

// Save saves a new or existing liability
func (r *LiabilityRepository) Save(ctx context.Context, liability *investment.Liability) error {
	isNew := liability.CreatedAt().IsZero() || liability.CreatedAt() == liability.UpdatedAt()

	if isNew {
		return r.create(ctx, liability)
	}
	return r.update(ctx, liability)
}

func (r *LiabilityRepository) create(ctx context.Context, liability *investment.Liability) error {
	query := `
		INSERT INTO liabilities (id, name, type, amount, remaining_amount, currency, user_id, interest_rate, due_date, notes, deleted_at, created_at, updated_at, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	now := time.Now()
	deletedAt := liability.DeletedAt()
	notes := liability.Notes()

	exec := GetExecutor(ctx, r.db)
	_, err := exec.ExecContext(ctx, query,
		liability.ID().String(),
		liability.Name(),
		liability.Type(),
		liability.Amount(),
		liability.RemainingAmount(),
		string(liability.Currency()),
		liability.UserID().String(),
		liability.InterestRate(),
		liability.DueDate(),
		notes,
		deletedAt,
		now,
		now,
		1,
	)
	if err != nil {
		r.log.Errorw("Failed to create liability", "error", err, "id", liability.ID())
		return fmt.Errorf("failed to create liability: %w", err)
	}

	r.log.Infow("Liability created", "id", liability.ID(), "user_id", liability.UserID())
	return nil
}

func (r *LiabilityRepository) update(ctx context.Context, liability *investment.Liability) error {
	query := `
		UPDATE liabilities
		SET name = $2, amount = $3, remaining_amount = $4, interest_rate = $5, due_date = $6, notes = $7, deleted_at = $8, updated_at = $9, version = version + 1
		WHERE id = $1 AND version = $10
	`

	now := time.Now()
	deletedAt := liability.DeletedAt()
	notes := liability.Notes()

	exec := GetExecutor(ctx, r.db)
	result, err := exec.ExecContext(ctx, query,
		liability.ID().String(),
		liability.Name(),
		liability.Amount(),
		liability.RemainingAmount(),
		liability.InterestRate(),
		liability.DueDate(),
		notes,
		deletedAt,
		now,
		liability.Version(),
	)
	if err != nil {
		r.log.Errorw("Failed to update liability", "error", err, "id", liability.ID())
		return fmt.Errorf("failed to update liability: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("liability not found or version mismatch")
	}

	r.log.Debugw("Liability updated", "id", liability.ID())
	return nil
}

// Delete soft-deletes a liability
func (r *LiabilityRepository) Delete(ctx context.Context, id string) error {
	query := `UPDATE liabilities SET deleted_at = $1, updated_at = $1 WHERE id = $2`

	now := time.Now()
	exec := GetExecutor(ctx, r.db)
	result, err := exec.ExecContext(ctx, query, now, id)
	if err != nil {
		r.log.Errorw("Failed to delete liability", "error", err, "id", id)
		return fmt.Errorf("failed to delete liability: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("liability not found")
	}

	r.log.Infow("Liability deleted", "id", id)
	return nil
}

// Count returns the number of liabilities for a user
func (r *LiabilityRepository) Count(ctx context.Context, userID shared.UserID) (int, error) {
	query := `SELECT COUNT(*) FROM liabilities WHERE user_id = $1 AND deleted_at IS NULL`

	var count int
	exec := GetExecutor(ctx, r.db)
	err := exec.QueryRowContext(ctx, query, userID.String()).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count liabilities: %w", err)
	}

	return count, nil
}

// liabilityModel represents the database model for liabilities
type liabilityModel struct {
	ID              uuid.UUID
	Name            string
	Type            investment.LiabilityType
	Amount          float64
	RemainingAmount float64
	Currency        string
	UserID          string
	InterestRate    *float64
	DueDate         *time.Time
	Notes           *string
	DeletedAt       *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// toDomain converts a database model to a domain aggregate
func (r *LiabilityRepository) toDomain(m liabilityModel, version int) (*investment.Liability, error) {
	userID, err := shared.UserIDFromString(m.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %w", err)
	}

	currency := shared.Currency(m.Currency)
	if !currency.IsValid() {
		return nil, fmt.Errorf("invalid currency: %s", m.Currency)
	}

	return investment.RestoreLiability(
		m.ID,
		m.Name,
		m.Type,
		m.Amount,
		m.RemainingAmount,
		currency,
		userID,
		m.InterestRate,
		m.DueDate,
		m.Notes,
		m.DeletedAt,
		m.CreatedAt,
		m.UpdatedAt,
		version,
	), nil
}
