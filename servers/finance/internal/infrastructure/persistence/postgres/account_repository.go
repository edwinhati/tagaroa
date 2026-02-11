package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/account"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/logger"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// AccountRepository implements account.Repository for PostgreSQL
type AccountRepository struct {
	db  *sql.DB
	log *zap.SugaredLogger
}

// NewAccountRepository creates a new account repository
func NewAccountRepository(db *sql.DB) *AccountRepository {
	return &AccountRepository{
		db:  db,
		log: logger.New().With("repository", "account"),
	}
}

const accountSelectCols = `
	id, name, type, balance, user_id, currency, notes, deleted_at, created_at, updated_at, version
`

// FindByID finds an account by ID
func (r *AccountRepository) FindByID(ctx context.Context, id uuid.UUID) (*account.Account, error) {
	query := fmt.Sprintf("SELECT %s FROM accounts WHERE id = $1 AND deleted_at IS NULL", accountSelectCols)

	var acc accountModel
	var deletedAt sql.NullTime
	var version int

	exec := GetExecutor(ctx, r.db)
	err := exec.QueryRowContext(ctx, query, id).Scan(
		&acc.ID, &acc.Name, &acc.Type, &acc.Balance,
		&acc.UserID, &acc.Currency, &acc.Notes, &deletedAt,
		&acc.CreatedAt, &acc.UpdatedAt, &version,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.Errorw("Failed to find account", "error", err, "id", id)
		return nil, fmt.Errorf("failed to find account: %w", err)
	}

	if deletedAt.Valid {
		acc.DeletedAt = &deletedAt.Time
	}

	return r.toDomain(acc, version)
}

// FindByUserID finds all accounts for a user
func (r *AccountRepository) FindByUserID(ctx context.Context, userID shared.UserID) ([]*account.Account, error) {
	query := fmt.Sprintf("SELECT %s FROM accounts WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC", accountSelectCols)

	exec := GetExecutor(ctx, r.db)
	rows, err := exec.QueryContext(ctx, query, userID.String())
	if err != nil {
		r.log.Errorw("Failed to find accounts", "error", err, "user_id", userID)
		return nil, fmt.Errorf("failed to find accounts: %w", err)
	}
	defer rows.Close()

	var accounts []*account.Account
	for rows.Next() {
		var acc accountModel
		var deletedAt sql.NullTime
		var version int

		if err := rows.Scan(
			&acc.ID, &acc.Name, &acc.Type, &acc.Balance,
			&acc.UserID, &acc.Currency, &acc.Notes, &deletedAt,
			&acc.CreatedAt, &acc.UpdatedAt, &version,
		); err != nil {
			return nil, fmt.Errorf("failed to scan account: %w", err)
		}

		if deletedAt.Valid {
			acc.DeletedAt = &deletedAt.Time
		}

		domainAcc, err := r.toDomain(acc, version)
		if err != nil {
			return nil, fmt.Errorf("failed to convert to domain: %w", err)
		}

		accounts = append(accounts, domainAcc)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating accounts: %w", err)
	}

	return accounts, nil
}

// Save saves a new or existing account
func (r *AccountRepository) Save(ctx context.Context, acc *account.Account) error {
	isNew := acc.CreatedAt().IsZero() || acc.CreatedAt() == acc.UpdatedAt()

	if isNew {
		return r.create(ctx, acc)
	}
	return r.update(ctx, acc)
}

func (r *AccountRepository) create(ctx context.Context, acc *account.Account) error {
	query := `
		INSERT INTO accounts (id, name, type, balance, user_id, currency, notes, deleted_at, created_at, updated_at, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	now := time.Now()
	deletedAt := acc.DeletedAt()

	exec := GetExecutor(ctx, r.db)
	_, err := exec.ExecContext(ctx, query,
		acc.ID(),
		acc.Name(),
		acc.Type(),
		acc.Balance(),
		acc.UserID().String(),
		acc.Currency(),
		acc.Notes(),
		deletedAt,
		now,
		now,
		1,
	)
	if err != nil {
		r.log.Errorw("Failed to create account", "error", err, "id", acc.ID())
		return fmt.Errorf("failed to create account: %w", err)
	}

	r.log.Infow("Account created", "id", acc.ID(), "user_id", acc.UserID())
	return nil
}

func (r *AccountRepository) update(ctx context.Context, acc *account.Account) error {
	query := `
		UPDATE accounts
		SET name = $2, balance = $3, notes = $4, deleted_at = $5, updated_at = $6, version = version + 1
		WHERE id = $1 AND version = $7
	`

	now := time.Now()
	deletedAt := acc.DeletedAt()

	// Use OriginalVersion() for optimistic locking - this returns the version when the entity was loaded
	expectedVersion := acc.OriginalVersion()

	exec := GetExecutor(ctx, r.db)
	result, err := exec.ExecContext(ctx, query,
		acc.ID(),
		acc.Name(),
		acc.Balance(),
		acc.Notes(),
		deletedAt,
		now,
		expectedVersion,
	)
	if err != nil {
		r.log.Errorw("Failed to update account", "error", err, "id", acc.ID())
		return fmt.Errorf("failed to update account: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("account not found or version mismatch")
	}

	r.log.Debugw("Account updated", "id", acc.ID())
	return nil
}

// Delete soft-deletes an account
func (r *AccountRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE accounts SET deleted_at = $1, updated_at = $1 WHERE id = $2`

	now := time.Now()
	result, err := r.db.ExecContext(ctx, query, now, id)
	if err != nil {
		r.log.Errorw("Failed to delete account", "error", err, "id", id)
		return fmt.Errorf("failed to delete account: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("account not found")
	}

	r.log.Infow("Account deleted", "id", id)
	return nil
}

// Exists checks if an account exists for a user
func (r *AccountRepository) Exists(ctx context.Context, userID shared.UserID, name string) (bool, error) {
	query := `SELECT 1 FROM accounts WHERE user_id = $1 AND name = $2 AND deleted_at IS NULL LIMIT 1`

	var exists int
	exec := GetExecutor(ctx, r.db)
	err := exec.QueryRowContext(ctx, query, userID.String(), name).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check account existence: %w", err)
	}

	return true, nil
}

// Count returns the number of accounts for a user
func (r *AccountRepository) Count(ctx context.Context, userID shared.UserID) (int, error) {
	query := `SELECT COUNT(*) FROM accounts WHERE user_id = $1 AND deleted_at IS NULL`

	var count int
	exec := GetExecutor(ctx, r.db)
	err := exec.QueryRowContext(ctx, query, userID.String()).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count accounts: %w", err)
	}

	return count, nil
}

// accountModel represents the database model for accounts
type accountModel struct {
	ID        uuid.UUID
	Name      string
	Type      account.AccountType
	Balance   float64
	UserID    string
	Currency  string
	Notes     *string
	DeletedAt *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

// toDomain converts a database model to a domain aggregate
func (r *AccountRepository) toDomain(m accountModel, version int) (*account.Account, error) {
	userID, err := shared.UserIDFromString(m.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %w", err)
	}

	currency := shared.Currency(m.Currency)
	if !currency.IsValid() {
		return nil, fmt.Errorf("invalid currency: %s", m.Currency)
	}

	return account.RestoreAccount(
		m.ID,
		m.Name,
		m.Type,
		m.Balance,
		userID,
		currency,
		m.Notes,
		m.DeletedAt,
		m.CreatedAt,
		m.UpdatedAt,
		version,
	), nil
}
