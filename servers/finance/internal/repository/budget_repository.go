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

// Budget field order constants
const budgetSkipFieldSearch = "search"

var (
	budgetFieldOrderDefault = []string{"user_id", "month", "year"}
	budgetFieldOrderWithID  = []string{"id", "user_id", "month", "year"}
	budgetItemFieldOrder    = []string{"budget_id"}
)

type BudgetRepository interface {
	Create(ctx context.Context, budget *model.Budget) error
	Update(ctx context.Context, budget *model.Budget) error
	FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Budget, error)
	FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Budget, error)
	Count(ctx context.Context, where map[string]any) (int, error)
	CreateItem(ctx context.Context, budgetItem *model.BudgetItem) error
	UpdateItem(ctx context.Context, budgetItem *model.BudgetItem) error
	GetBudgetItemSpent(ctx context.Context, budgetItemID uuid.UUID) (float64, error)
	GetBudgetItemsSpent(ctx context.Context, budgetItemIDs []uuid.UUID) (map[uuid.UUID]float64, error)
}

type budgetRepository struct {
	db *sql.DB
}

func NewBudgetRepository(db *sql.DB) BudgetRepository {
	return &budgetRepository{db: db}
}

/* ----------------------------- Utilities ----------------------------- */
const budgetSelectCols = `
	id,
	month,
	year,
	amount,
	user_id,
	currency,
	deleted_at,
	created_at,
	updated_at
`

const budgetItemSelectCols = `
	id,
	allocation,
	budget_id,
	category,
	deleted_at,
	created_at,
	updated_at
`

func scanBudget(scanner util.RowScanner) (*model.Budget, error) {
	var b model.Budget
	var deletedAt sql.NullTime

	if err := scanner.Scan(
		&b.ID, &b.Month, &b.Year, &b.Amount,
		&b.UserID, &b.Currency, &deletedAt,
		&b.CreatedAt, &b.UpdatedAt,
	); err != nil {
		return nil, err
	}

	if deletedAt.Valid {
		t := deletedAt.Time
		b.DeletedAt = &t
	}

	return &b, nil
}

func scanBudgetItem(scanner util.RowScanner) (*model.BudgetItem, error) {
	var item model.BudgetItem
	var deletedAt sql.NullTime

	if err := scanner.Scan(
		&item.ID,
		&item.Allocation,
		&item.BudgetID,
		&item.Category,
		&deletedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return nil, err
	}

	if deletedAt.Valid {
		t := deletedAt.Time
		item.DeletedAt = &t
	}

	return &item, nil
}

/* ----------------------------- CRUD ops ------------------------------ */

func (r *budgetRepository) Create(ctx context.Context, budget *model.Budget) error {
	if budget.ID == uuid.Nil {
		budget.ID = uuid.New()
	}
	now := time.Now()
	budget.CreatedAt = now
	budget.UpdatedAt = now

	query := `
		INSERT INTO budgets (id, month, year, amount, user_id, currency, deleted_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err := r.db.ExecContext(ctx, query, budget.ID, budget.Month, budget.Year, budget.Amount, budget.UserID, budget.Currency, budget.DeletedAt, budget.CreatedAt, budget.UpdatedAt)
	return err
}

func (r *budgetRepository) Update(ctx context.Context, budget *model.Budget) error {
	budget.UpdatedAt = time.Now()

	query := `
		UPDATE budgets
		SET month = $1, year = $2, amount = $3, currency = $4, updated_at = $5
		WHERE id = $6 AND deleted_at IS NULL
	`

	_, err := r.db.ExecContext(ctx, query, budget.Month, budget.Year, budget.Amount, budget.Currency, budget.UpdatedAt, budget.ID)
	return err
}

func (r *budgetRepository) FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Budget, error) {
	var sb strings.Builder
	sb.WriteString("SELECT ")
	sb.WriteString(strings.TrimSpace(budgetSelectCols))
	sb.WriteString(" FROM budgets")

	whereClause, args := util.BuildWhere(params.Where, util.WhereBuildOpts{
		FieldOrder:     budgetFieldOrderDefault,
		SkipField:      budgetSkipFieldSearch, // budgets do not support text search
		ExcludeDeleted: true,                  // always exclude deleted budgets
	})
	sb.WriteString(whereClause)
	sb.WriteString(" ORDER BY year ASC, month ASC")

	// Pagination (placeholders after WHERE args)
	currIdx := len(args) + 1
	currIdx, args = util.AddOffsetLimit(&sb, params.Offset, params.Limit, currIdx, args)

	rows, err := r.db.QueryContext(ctx, sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var budgets []*model.Budget
	for rows.Next() {
		budget, err := scanBudget(rows)
		if err != nil {
			return nil, err
		}
		budgets = append(budgets, budget)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return budgets, nil
}

func (r *budgetRepository) FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Budget, error) {
	var sb strings.Builder
	sb.WriteString("SELECT ")
	sb.WriteString(strings.TrimSpace(budgetSelectCols))
	sb.WriteString(" FROM budgets")

	whereClause, args := util.BuildWhere(params.Where, util.WhereBuildOpts{
		FieldOrder:     budgetFieldOrderWithID,
		SkipField:      budgetSkipFieldSearch,
		ExcludeDeleted: true,
	})
	sb.WriteString(whereClause)
	sb.WriteString(" LIMIT 1")

	row := r.db.QueryRowContext(ctx, sb.String(), args...)

	sb.Reset()
	sb.WriteString("SELECT ")
	sb.WriteString(strings.TrimSpace(budgetItemSelectCols))
	sb.WriteString(" FROM budget_items")

	budget, err := scanBudget(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	whereClause, args = util.BuildWhere(map[string]any{
		"budget_id": budget.ID,
	}, util.WhereBuildOpts{
		FieldOrder:     budgetItemFieldOrder,
		SkipField:      budgetSkipFieldSearch,
		ExcludeDeleted: true,
	})
	sb.WriteString(whereClause)
	sb.WriteString(" ORDER BY category ASC ")

	rows, err := r.db.QueryContext(ctx, sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		item, err := scanBudgetItem(rows)
		if err != nil {
			return nil, err
		}
		budget.BudgetItems = append(budget.BudgetItems, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return budget, nil
}

func (r *budgetRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	var sb strings.Builder
	sb.WriteString("SELECT COUNT(*) FROM budgets")

	whereClause, args := util.BuildWhere(where, util.WhereBuildOpts{
		FieldOrder:     budgetFieldOrderWithID,
		SkipField:      budgetSkipFieldSearch,
		ExcludeDeleted: true,
	})
	sb.WriteString(whereClause)

	row := r.db.QueryRowContext(ctx, sb.String(), args...)
	var count int
	if err := row.Scan(&count); err != nil {
		if err == sql.ErrNoRows {
			return 0, nil
		}
		return 0, err
	}

	return count, nil
}

func (r *budgetRepository) CreateItem(ctx context.Context, budgetItem *model.BudgetItem) error {
	if budgetItem.ID == uuid.Nil {
		budgetItem.ID = uuid.New()
	}
	now := time.Now()
	budgetItem.CreatedAt = now
	budgetItem.UpdatedAt = now

	query := `
		INSERT INTO budget_items (id, allocation, budget_id, category, deleted_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	_, err := r.db.ExecContext(ctx, query, budgetItem.ID, budgetItem.Allocation, budgetItem.BudgetID, budgetItem.Category, budgetItem.DeletedAt, budgetItem.CreatedAt, budgetItem.UpdatedAt)
	return err
}

func (r *budgetRepository) UpdateItem(ctx context.Context, budgetItem *model.BudgetItem) error {
	budgetItem.UpdatedAt = time.Now()

	query := `
		UPDATE budget_items
		SET allocation = $1, category = $2, updated_at = $3
		WHERE id = $4 AND deleted_at IS NULL
	`

	_, err := r.db.ExecContext(ctx, query, budgetItem.Allocation, budgetItem.Category, budgetItem.UpdatedAt, budgetItem.ID)
	return err
}

// GetBudgetItemSpent calculates the total spent amount for a budget item
// by summing all EXPENSE transactions linked to it
func (r *budgetRepository) GetBudgetItemSpent(ctx context.Context, budgetItemID uuid.UUID) (float64, error) {
	query := `
		SELECT COALESCE(SUM(amount), 0)
		FROM transactions
		WHERE budget_item_id = $1
		  AND type = 'EXPENSE'
		  AND deleted_at IS NULL
	`

	var spent float64
	if err := r.db.QueryRowContext(ctx, query, budgetItemID).Scan(&spent); err != nil {
		return 0, err
	}
	return spent, nil
}

// GetBudgetItemsSpent calculates the total spent amount for multiple budget items
// Returns a map of budget_item_id -> spent amount
func (r *budgetRepository) GetBudgetItemsSpent(ctx context.Context, budgetItemIDs []uuid.UUID) (map[uuid.UUID]float64, error) {
	if len(budgetItemIDs) == 0 {
		return make(map[uuid.UUID]float64), nil
	}

	// Build placeholders for IN clause
	placeholders := make([]string, len(budgetItemIDs))
	args := make([]any, len(budgetItemIDs))
	for i, id := range budgetItemIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}

	query := fmt.Sprintf(`
		SELECT budget_item_id, COALESCE(SUM(amount), 0) as spent
		FROM transactions
		WHERE budget_item_id IN (%s)
		  AND type = 'EXPENSE'
		  AND deleted_at IS NULL
		GROUP BY budget_item_id
	`, strings.Join(placeholders, ", "))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[uuid.UUID]float64)
	for rows.Next() {
		var budgetItemID uuid.UUID
		var spent float64
		if err := rows.Scan(&budgetItemID, &spent); err != nil {
			return nil, err
		}
		result[budgetItemID] = spent
	}

	// Initialize zero for items with no transactions
	for _, id := range budgetItemIDs {
		if _, exists := result[id]; !exists {
			result[id] = 0
		}
	}

	return result, nil
}
