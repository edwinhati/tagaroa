package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/budget"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/logger"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// BudgetRepository implements budget.Repository for PostgreSQL
type BudgetRepository struct {
	db  *sql.DB
	log *zap.SugaredLogger
}

// NewBudgetRepository creates a new budget repository
func NewBudgetRepository(db *sql.DB) *BudgetRepository {
	return &BudgetRepository{
		db:  db,
		log: logger.New().With("repository", "budget"),
	}
}

const budgetSelectCols = `
	id, month, year, amount, user_id, currency, deleted_at, created_at, updated_at, version
`

// FindByID finds a budget by ID
func (r *BudgetRepository) FindByID(ctx context.Context, id string) (*budget.Budget, error) {
	query := fmt.Sprintf("SELECT %s FROM budgets WHERE id = $1 AND deleted_at IS NULL", budgetSelectCols)

	var bud budgetModel
	var deletedAt sql.NullTime
	var version int

	exec := GetExecutor(ctx, r.db)
	err := exec.QueryRowContext(ctx, query, id).Scan(
		&bud.ID, &bud.Month, &bud.Year, &bud.Amount,
		&bud.UserID, &bud.Currency, &deletedAt,
		&bud.CreatedAt, &bud.UpdatedAt, &version,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.Errorw("Failed to find budget", "error", err, "id", id)
		return nil, fmt.Errorf("failed to find budget: %w", err)
	}

	if deletedAt.Valid {
		bud.DeletedAt = &deletedAt.Time
	}

	// Load budget items
	items, err := r.loadBudgetItems(ctx, bud.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to load budget items: %w", err)
	}

	return r.toDomain(bud, version, items)
}

// FindByMonthYear finds a budget by user, month, and year
func (r *BudgetRepository) FindByMonthYear(ctx context.Context, userID shared.UserID, month, year int) (*budget.Budget, error) {
	query := fmt.Sprintf("SELECT %s FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3 AND deleted_at IS NULL", budgetSelectCols)

	var bud budgetModel
	var deletedAt sql.NullTime
	var version int

	exec := GetExecutor(ctx, r.db)
	err := exec.QueryRowContext(ctx, query, userID.String(), month, year).Scan(
		&bud.ID, &bud.Month, &bud.Year, &bud.Amount,
		&bud.UserID, &bud.Currency, &deletedAt,
		&bud.CreatedAt, &bud.UpdatedAt, &version,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.Errorw("Failed to find budget", "error", err, "user_id", userID, "month", month, "year", year)
		return nil, fmt.Errorf("failed to find budget: %w", err)
	}

	if deletedAt.Valid {
		bud.DeletedAt = &deletedAt.Time
	}

	// Load budget items
	items, err := r.loadBudgetItems(ctx, bud.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to load budget items: %w", err)
	}

	return r.toDomain(bud, version, items)
}

// FindByUser finds all budgets for a user
func (r *BudgetRepository) FindByUser(ctx context.Context, userID shared.UserID) ([]*budget.Budget, error) {
	query := fmt.Sprintf("SELECT %s FROM budgets WHERE user_id = $1 AND deleted_at IS NULL ORDER BY year DESC, month DESC", budgetSelectCols)

	exec := GetExecutor(ctx, r.db)
	rows, err := exec.QueryContext(ctx, query, userID.String())
	if err != nil {
		r.log.Errorw("Failed to find budgets", "error", err, "user_id", userID)
		return nil, fmt.Errorf("failed to find budgets: %w", err)
	}
	defer rows.Close()

	var budgets []*budget.Budget
	for rows.Next() {
		var bud budgetModel
		var deletedAt sql.NullTime
		var version int

		if err := rows.Scan(
			&bud.ID, &bud.Month, &bud.Year, &bud.Amount,
			&bud.UserID, &bud.Currency, &deletedAt,
			&bud.CreatedAt, &bud.UpdatedAt, &version,
		); err != nil {
			return nil, fmt.Errorf("failed to scan budget: %w", err)
		}

		if deletedAt.Valid {
			bud.DeletedAt = &deletedAt.Time
		}

		// Load budget items
		items, err := r.loadBudgetItems(ctx, bud.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to load budget items: %w", err)
		}

		domainBud, err := r.toDomain(bud, version, items)
		if err != nil {
			return nil, fmt.Errorf("failed to convert to domain: %w", err)
		}

		budgets = append(budgets, domainBud)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating budgets: %w", err)
	}

	return budgets, nil
}

// Save saves a new or existing budget
func (r *BudgetRepository) Save(ctx context.Context, bud *budget.Budget) error {
	// Check if this is a new budget
	isNew := bud.CreatedAt().IsZero() || bud.CreatedAt() == bud.UpdatedAt()

	if isNew {
		return r.create(ctx, bud)
	}
	return r.update(ctx, bud)
}

func (r *BudgetRepository) create(ctx context.Context, bud *budget.Budget) error {
	query := `
		INSERT INTO budgets (id, month, year, amount, user_id, currency, deleted_at, created_at, updated_at, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	now := time.Now()
	deletedAt := bud.DeletedAt()

	exec := GetExecutor(ctx, r.db)
	_, err := exec.ExecContext(ctx, query,
		bud.ID().String(),
		bud.Month(),
		bud.Year(),
		bud.Amount(),
		bud.UserID().String(),
		string(bud.Currency()),
		deletedAt,
		now,
		now,
		1,
	)
	if err != nil {
		r.log.Errorw("Failed to create budget", "error", err, "id", bud.ID())
		return fmt.Errorf("failed to create budget: %w", err)
	}

	r.log.Infow("Budget created", "id", bud.ID(), "user_id", bud.UserID())
	return nil
}

func (r *BudgetRepository) update(ctx context.Context, bud *budget.Budget) error {
	query := `
		UPDATE budgets
		SET amount = $2, deleted_at = $3, updated_at = $4, version = version + 1
		WHERE id = $1 AND version = $5
	`

	now := time.Now()
	deletedAt := bud.DeletedAt()

	exec := GetExecutor(ctx, r.db)
	result, err := exec.ExecContext(ctx, query,
		bud.ID().String(),
		bud.Amount(),
		deletedAt,
		now,
		bud.Version(),
	)
	if err != nil {
		r.log.Errorw("Failed to update budget", "error", err, "id", bud.ID())
		return fmt.Errorf("failed to update budget: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("budget not found or version mismatch")
	}

	r.log.Debugw("Budget updated", "id", bud.ID())
	return nil
}

// Delete soft-deletes a budget
func (r *BudgetRepository) Delete(ctx context.Context, id string) error {
	query := `UPDATE budgets SET deleted_at = $1, updated_at = $1 WHERE id = $2`

	now := time.Now()
	exec := GetExecutor(ctx, r.db)
	result, err := exec.ExecContext(ctx, query, now, id)
	if err != nil {
		r.log.Errorw("Failed to delete budget", "error", err, "id", id)
		return fmt.Errorf("failed to delete budget: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("budget not found")
	}

	r.log.Infow("Budget deleted", "id", id)
	return nil
}

// Exists checks if a budget exists for user, month, and year
func (r *BudgetRepository) Exists(ctx context.Context, userID shared.UserID, month, year int) (bool, error) {
	query := `SELECT 1 FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3 AND deleted_at IS NULL LIMIT 1`

	var exists int
	exec := GetExecutor(ctx, r.db)
	err := exec.QueryRowContext(ctx, query, userID.String(), month, year).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check budget existence: %w", err)
	}

	return true, nil
}

// Count returns the number of budgets for a user
func (r *BudgetRepository) Count(ctx context.Context, userID shared.UserID) (int, error) {
	query := `SELECT COUNT(*) FROM budgets WHERE user_id = $1 AND deleted_at IS NULL`

	var count int
	exec := GetExecutor(ctx, r.db)
	err := exec.QueryRowContext(ctx, query, userID.String()).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count budgets: %w", err)
	}

	return count, nil
}

// loadBudgetItems loads budget items for a budget
func (r *BudgetRepository) loadBudgetItems(ctx context.Context, budgetID uuid.UUID) ([]*budget.BudgetItem, error) {
	query := `
		SELECT id, allocation, category, spent, deleted_at, created_at, updated_at
		FROM budget_items
		WHERE budget_id = $1 AND deleted_at IS NULL
		ORDER BY created_at ASC
	`

	exec := GetExecutor(ctx, r.db)
	rows, err := exec.QueryContext(ctx, query, budgetID)
	if err != nil {
		return nil, fmt.Errorf("failed to query budget items: %w", err)
	}
	defer rows.Close()

	var items []*budget.BudgetItem
	for rows.Next() {
		var item budgetItemModel
		var deletedAt sql.NullTime

		if err := rows.Scan(
			&item.ID, &item.Allocation, &item.Category, &item.Spent,
			&deletedAt, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan budget item: %w", err)
		}

		if deletedAt.Valid {
			item.DeletedAt = &deletedAt.Time
		}

		items = append(items, item.toDomain())
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating budget items: %w", err)
	}

	return items, nil
}

// budgetModel represents the database model for budgets
type budgetModel struct {
	ID        uuid.UUID
	Month     int
	Year      int
	Amount    float64
	UserID    string
	Currency  string
	DeletedAt *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

// budgetItemModel represents the database model for budget items
type budgetItemModel struct {
	ID         uuid.UUID
	Allocation float64
	Category   string
	Spent      float64
	DeletedAt  *time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// toDomain converts a budget item database model to a domain entity
func (m *budgetItemModel) toDomain() *budget.BudgetItem {
	return budget.RestoreBudgetItem(
		m.ID,
		m.Allocation,
		m.Category,
		m.Spent,
		m.DeletedAt,
		m.CreatedAt,
		m.UpdatedAt,
	)
}

// toDomain converts a budget database model to a domain aggregate
func (r *BudgetRepository) toDomain(m budgetModel, version int, items []*budget.BudgetItem) (*budget.Budget, error) {
	userID, err := shared.UserIDFromString(m.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %w", err)
	}

	currency := shared.Currency(m.Currency)
	if !currency.IsValid() {
		return nil, fmt.Errorf("invalid currency: %s", m.Currency)
	}

	return budget.RestoreBudget(
		m.ID,
		m.Month,
		m.Year,
		m.Amount,
		userID,
		currency,
		m.DeletedAt,
		m.CreatedAt,
		m.UpdatedAt,
		version,
		items,
	), nil
}
