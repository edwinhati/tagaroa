package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/transaction"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/logger"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"go.uber.org/zap"
)

// TransactionRepository implements transaction.Repository for PostgreSQL
type TransactionRepository struct {
	db        *sql.DB
	log       *zap.SugaredLogger
	pgTypeMap *pgtype.Map
}

// NewTransactionRepository creates a new transaction repository
func NewTransactionRepository(db *sql.DB) *TransactionRepository {
	return &TransactionRepository{
		db:        db,
		log:       logger.New().With("repository", "transaction"),
		pgTypeMap: pgtype.NewMap(),
	}
}

const transactionSelectCols = `
	t.id, t.amount, t.date, t.type, t.currency, t.notes, t.files, t.user_id, t.account_id, t.budget_item_id, t.deleted_at, t.created_at, t.updated_at, t.version,
	a.name, a.type, a.balance, a.currency,
	bi.allocation, bi.category
`

// FindByID finds a transaction by ID
func (r *TransactionRepository) FindByID(ctx context.Context, id uuid.UUID) (*transaction.Transaction, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM transactions t
		LEFT JOIN accounts a ON t.account_id = a.id
		LEFT JOIN budget_items bi ON t.budget_item_id = bi.id
		WHERE t.id = $1 AND t.deleted_at IS NULL
	`, transactionSelectCols)

	var txn transactionModel
	var deletedAt sql.NullTime
	var version int
	var files []string

	exec := GetExecutor(ctx, r.db)
	err := exec.QueryRowContext(ctx, query, id).Scan(
		&txn.ID, &txn.Amount, &txn.Date, &txn.Type,
		&txn.Currency, &txn.Notes,
		r.pgTypeMap.SQLScanner(&files),
		&txn.UserID,
		&txn.AccountID, &txn.BudgetItemID, &deletedAt,
		&txn.CreatedAt, &txn.UpdatedAt, &version,
		&txn.AccountName, &txn.AccountType, &txn.AccountBalance, &txn.AccountCurrency,
		&txn.BudgetItemAllocation, &txn.BudgetItemCategory,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		r.log.Errorw("Failed to find transaction", "error", err, "id", id)
		return nil, fmt.Errorf("failed to find transaction: %w", err)
	}

	txn.Files = files

	if deletedAt.Valid {
		txn.DeletedAt = &deletedAt.Time
	}

	return r.toDomain(txn, version)
}

// FindMany finds transactions with filters
func (r *TransactionRepository) FindMany(ctx context.Context, params transaction.FindManyParams) (*transaction.FindManyResult, error) {
	// Build WHERE clause
	whereParts := []string{"t.user_id = $1", "t.deleted_at IS NULL"}
	args := []any{params.UserID.String()}
	argIdx := 2

	if params.StartDate != nil {
		whereParts = append(whereParts, fmt.Sprintf("t.date >= $%d::date", argIdx))
		args = append(args, *params.StartDate)
		argIdx++
	}
	if params.EndDate != nil {
		whereParts = append(whereParts, fmt.Sprintf("t.date <= $%d::date", argIdx))
		args = append(args, *params.EndDate)
		argIdx++
	}
	if len(params.Types) > 0 {
		placeholders := make([]string, len(params.Types))
		for i, t := range params.Types {
			placeholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, t.String())
			argIdx++
		}
		whereParts = append(whereParts, fmt.Sprintf("t.type IN (%s)", strings.Join(placeholders, ",")))
	}
	if len(params.Currencies) > 0 {
		placeholders := make([]string, len(params.Currencies))
		for i, c := range params.Currencies {
			placeholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, string(c))
			argIdx++
		}
		whereParts = append(whereParts, fmt.Sprintf("t.currency IN (%s)", strings.Join(placeholders, ",")))
	}
	if len(params.Accounts) > 0 {
		placeholders := make([]string, len(params.Accounts))
		for i, a := range params.Accounts {
			placeholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, a)
			argIdx++
		}
		// Filter by account name instead of account_id, requires joining with accounts table
		whereParts = append(whereParts, fmt.Sprintf("EXISTS (SELECT 1 FROM accounts a WHERE a.id = t.account_id AND a.name IN (%s))", strings.Join(placeholders, ",")))
	}
	if len(params.Categories) > 0 {
		placeholders := make([]string, len(params.Categories))
		for i, c := range params.Categories {
			placeholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, c)
			argIdx++
		}
		whereParts = append(whereParts, fmt.Sprintf("bi.category IN (%s)", strings.Join(placeholders, ",")))
	}
	if params.Search != "" {
		whereParts = append(whereParts, fmt.Sprintf("(LOWER(t.notes) LIKE LOWER($%d) OR LOWER(COALESCE(t.notes, '')) LIKE LOWER($%d))", argIdx, argIdx+1))
		args = append(args, "%"+params.Search+"%", "%"+params.Search+"%")
		argIdx += 2
	}

	whereClause := strings.Join(whereParts, " AND ")

	// Get total count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM transactions t WHERE %s", whereClause)
	var total int
	exec := GetExecutor(ctx, r.db)
	if err := exec.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count transactions: %w", err)
	}

	// Add ORDER BY and LIMIT/OFFSET
	orderBy := "t.created_at DESC"
	if params.OrderBy != "" {
		// sanitization or mapping needed ideally, but keeping as is for now, just prefixing if standard field
		if !strings.Contains(params.OrderBy, ".") {
			orderBy = "t." + params.OrderBy
		} else {
			orderBy = params.OrderBy
		}
	}

	query := fmt.Sprintf(`
		SELECT %s
		FROM transactions t
		LEFT JOIN accounts a ON t.account_id = a.id
		LEFT JOIN budget_items bi ON t.budget_item_id = bi.id
		WHERE %s ORDER BY %s
	`, transactionSelectCols, whereClause, orderBy)

	if params.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, params.Limit)
		argIdx++
	}
	// Calculate offset from page and limit
	offset := 0
	if params.Page > 0 && params.Limit > 0 {
		offset = (params.Page - 1) * params.Limit
	}
	if offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, offset)
	}

	exec = GetExecutor(ctx, r.db)
	rows, err := exec.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query transactions: %w", err)
	}
	defer rows.Close()

	var transactions []*transaction.Transaction
	for rows.Next() {
		var txn transactionModel
		var deletedAt sql.NullTime
		var version int
		var files []string

		if err := rows.Scan(
			&txn.ID, &txn.Amount, &txn.Date, &txn.Type,
			&txn.Currency, &txn.Notes,
			r.pgTypeMap.SQLScanner(&files),
			&txn.UserID,
			&txn.AccountID, &txn.BudgetItemID, &deletedAt,
			&txn.CreatedAt, &txn.UpdatedAt, &version,
			&txn.AccountName, &txn.AccountType, &txn.AccountBalance, &txn.AccountCurrency,
			&txn.BudgetItemAllocation, &txn.BudgetItemCategory,
		); err != nil {
			return nil, fmt.Errorf("failed to scan transaction: %w", err)
		}

		txn.Files = files

		if deletedAt.Valid {
			txn.DeletedAt = &deletedAt.Time
		}

		domainTxn, err := r.toDomain(txn, version)
		if err != nil {
			return nil, fmt.Errorf("failed to convert to domain: %w", err)
		}

		transactions = append(transactions, domainTxn)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating transactions: %w", err)
	}

	// Fetch aggregations
	typeAggs, _ := r.GetTypeAggregations(ctx, params)
	currencyAggs, _ := r.GetCurrencyAggregations(ctx, params)
	accountAggs, _ := r.GetAccountAggregations(ctx, params)
	categoryAggs, _ := r.GetCategoryAggregations(ctx, params)

	return &transaction.FindManyResult{
		Transactions:         transactions,
		Total:                total,
		TypeAggregations:     typeAggs,
		CurrencyAggregations: currencyAggs,
		AccountAggregations:  accountAggs,
		CategoryAggregations: categoryAggs,
	}, nil
}

// Save saves a new or existing transaction
func (r *TransactionRepository) Save(ctx context.Context, txn *transaction.Transaction) error {
	isNew := txn.CreatedAt().IsZero() || txn.CreatedAt() == txn.UpdatedAt()

	if isNew {
		return r.create(ctx, txn)
	}
	return r.update(ctx, txn)
}

func (r *TransactionRepository) create(ctx context.Context, txn *transaction.Transaction) error {
	query := `
		INSERT INTO transactions (id, amount, date, type, currency, notes, files, user_id, account_id, budget_item_id, deleted_at, created_at, updated_at, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	now := time.Now()
	deletedAt := txn.DeletedAt()
	files := txn.Files()

	exec := GetExecutor(ctx, r.db)
	_, err := exec.ExecContext(ctx, query,
		txn.ID(),
		txn.Amount(),
		txn.Date(),
		txn.Type(),
		txn.Currency(),
		txn.Notes(),
		files,
		txn.UserID().String(),
		txn.AccountID(),
		txn.BudgetItemID(),
		deletedAt,
		now,
		now,
		1,
	)
	if err != nil {
		r.log.Errorw("Failed to create transaction", "error", err, "id", txn.ID())
		return fmt.Errorf("failed to create transaction: %w", err)
	}

	r.log.Infow("Transaction created", "id", txn.ID(), "user_id", txn.UserID())
	return nil
}

func (r *TransactionRepository) update(ctx context.Context, txn *transaction.Transaction) error {
	query := `
		UPDATE transactions
		SET amount = $2, date = $3, type = $4, currency = $5, notes = $6, files = $7,
		    account_id = $8, budget_item_id = $9, deleted_at = $10, updated_at = $11, version = version + 1
		WHERE id = $1 AND version = $12
	`

	now := time.Now()
	deletedAt := txn.DeletedAt()
	files := txn.Files()

	exec := GetExecutor(ctx, r.db)
	result, err := exec.ExecContext(ctx, query,
		txn.ID(),
		txn.Amount(),
		txn.Date(),
		txn.Type(),
		txn.Currency(),
		txn.Notes(),
		files,
		txn.AccountID(),
		txn.BudgetItemID(),
		deletedAt,
		now,
		txn.Version(),
	)
	if err != nil {
		r.log.Errorw("Failed to update transaction", "error", err, "id", txn.ID())
		return fmt.Errorf("failed to update transaction: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("transaction not found or version mismatch")
	}

	r.log.Debugw("Transaction updated", "id", txn.ID())
	return nil
}

// Delete soft-deletes a transaction
func (r *TransactionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE transactions SET deleted_at = $1, updated_at = $1 WHERE id = $2`

	now := time.Now()
	exec := GetExecutor(ctx, r.db)
	result, err := exec.ExecContext(ctx, query, now, id)
	if err != nil {
		r.log.Errorw("Failed to delete transaction", "error", err, "id", id)
		return fmt.Errorf("failed to delete transaction: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("transaction not found")
	}

	r.log.Infow("Transaction deleted", "id", id)
	return nil
}

// GetTypeAggregations aggregates transactions by type
func (r *TransactionRepository) GetTypeAggregations(ctx context.Context, params transaction.FindManyParams) (map[string]transaction.AggregationResult, error) {
	return r.getAggregations(ctx, params, "type")
}

// GetCurrencyAggregations aggregates transactions by currency
func (r *TransactionRepository) GetCurrencyAggregations(ctx context.Context, params transaction.FindManyParams) (map[string]transaction.AggregationResult, error) {
	return r.getAggregations(ctx, params, "currency")
}

// GetAccountAggregations aggregates transactions by account name
func (r *TransactionRepository) GetAccountAggregations(ctx context.Context, params transaction.FindManyParams) (map[string]transaction.AggregationResult, error) {
	// Build WHERE clause
	whereParts := []string{"t.user_id = $1", "t.deleted_at IS NULL"}
	args := []any{params.UserID.String()}
	argIdx := 2

	if params.StartDate != nil {
		whereParts = append(whereParts, fmt.Sprintf("t.date >= $%d::date", argIdx))
		args = append(args, *params.StartDate)
		argIdx++
	}
	if params.EndDate != nil {
		whereParts = append(whereParts, fmt.Sprintf("t.date <= $%d::date", argIdx))
		args = append(args, *params.EndDate)
		argIdx++
	}

	whereClause := strings.Join(whereParts, " AND ")

	query := fmt.Sprintf(`
		SELECT a.name, COUNT(*) as count, MIN(t.amount) as min, MAX(t.amount) as max, AVG(t.amount) as avg, SUM(t.amount) as sum
		FROM transactions t
		INNER JOIN accounts a ON t.account_id = a.id
		WHERE %s
		GROUP BY a.name
	`, whereClause)

	exec := GetExecutor(ctx, r.db)
	rows, err := exec.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query account aggregations: %w", err)
	}
	defer rows.Close()

	results := make(map[string]transaction.AggregationResult)
	for rows.Next() {
		var key sql.NullString
		var result transaction.AggregationResult

		if err := rows.Scan(&key, &result.Count, &result.Min, &result.Max, &result.Avg, &result.Sum); err != nil {
			return nil, fmt.Errorf("failed to scan aggregation: %w", err)
		}

		results[key.String] = result
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating aggregations: %w", err)
	}

	return results, nil
}

// GetCategoryAggregations aggregates transactions by category (via budget items)
func (r *TransactionRepository) GetCategoryAggregations(ctx context.Context, params transaction.FindManyParams) (map[string]transaction.AggregationResult, error) {
	return r.getAggregations(ctx, params, "bi.category")
}

// Count returns the number of transactions matching filters
func (r *TransactionRepository) Count(ctx context.Context, params transaction.FindManyParams) (int, error) {
	whereParts := []string{"t.user_id = $1", "t.deleted_at IS NULL"}
	args := []any{params.UserID.String()}
	argIdx := 2

	if params.StartDate != nil {
		whereParts = append(whereParts, fmt.Sprintf("t.date >= $%d::date", argIdx))
		args = append(args, *params.StartDate)
		argIdx++
	}
	if params.EndDate != nil {
		whereParts = append(whereParts, fmt.Sprintf("t.date <= $%d::date", argIdx))
		args = append(args, *params.EndDate)
		argIdx++
	}

	whereClause := strings.Join(whereParts, " AND ")
	query := fmt.Sprintf("SELECT COUNT(*) FROM transactions t WHERE %s", whereClause)

	var count int
	exec := GetExecutor(ctx, r.db)
	if err := exec.QueryRowContext(ctx, query, args...).Scan(&count); err != nil {
		return 0, fmt.Errorf("failed to count transactions: %w", err)
	}

	return count, nil
}

func (r *TransactionRepository) getAggregations(ctx context.Context, params transaction.FindManyParams, groupByColumn string) (map[string]transaction.AggregationResult, error) {
	// Build WHERE clause
	whereParts := []string{"t.user_id = $1", "t.deleted_at IS NULL"}
	args := []any{params.UserID.String()}
	argIdx := 2

	if params.StartDate != nil {
		whereParts = append(whereParts, fmt.Sprintf("t.date >= $%d::date", argIdx))
		args = append(args, *params.StartDate)
		argIdx++
	}
	if params.EndDate != nil {
		whereParts = append(whereParts, fmt.Sprintf("t.date <= $%d::date", argIdx))
		args = append(args, *params.EndDate)
		argIdx++
	}

	whereClause := strings.Join(whereParts, " AND ")

	// Ensure groupByColumn is not ambiguous or invalid
	// For bi.category, we need to join budget_items
	joinClause := ""
	if strings.Contains(groupByColumn, "bi.") {
		joinClause = "LEFT JOIN budget_items bi ON t.budget_item_id = bi.id"
	}
	if strings.Contains(groupByColumn, "a.") {
		joinClause += " LEFT JOIN accounts a ON t.account_id = a.id"
	}

	// If grouping by category and it's null, we might want to group as "Uncategorized" or similar.
	// But standard GROUP BY will group NULLs together.

	// For simple columns like type, currency, account_id, we prefix with t. if not present
	if !strings.Contains(groupByColumn, ".") {
		groupByColumn = "t." + groupByColumn
	}

	query := fmt.Sprintf(`
		SELECT %s, COUNT(*) as count, MIN(t.amount) as min, MAX(t.amount) as max, AVG(t.amount) as avg, SUM(t.amount) as sum
		FROM transactions t
		%s
		WHERE %s
		GROUP BY %s
	`, groupByColumn, joinClause, whereClause, groupByColumn)

	exec := GetExecutor(ctx, r.db)
	rows, err := exec.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query aggregations: %w", err)
	}
	defer rows.Close()

	results := make(map[string]transaction.AggregationResult)
	for rows.Next() {
		var key sql.NullString
		var result transaction.AggregationResult

		if err := rows.Scan(&key, &result.Count, &result.Min, &result.Max, &result.Avg, &result.Sum); err != nil {
			return nil, fmt.Errorf("failed to scan aggregation: %w", err)
		}

		// Skip NULL keys to exclude "empty" categories from aggregations
		if !key.Valid {
			continue
		}

		results[key.String] = result
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating aggregations: %w", err)
	}

	return results, nil
}

// transactionModel represents the database model for transactions
type transactionModel struct {
	ID           uuid.UUID
	Amount       float64
	Date         time.Time
	Type         transaction.TransactionType
	Currency     string
	Notes        *string
	Files        []string
	UserID       string
	AccountID    uuid.UUID
	BudgetItemID *uuid.UUID
	DeletedAt    *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time

	// Joined fields
	AccountName          sql.NullString
	AccountType          sql.NullString
	AccountBalance       sql.NullFloat64
	AccountCurrency      sql.NullString
	BudgetItemAllocation sql.NullFloat64
	BudgetItemCategory   sql.NullString
}

// toDomain converts a database model to a domain aggregate
func (r *TransactionRepository) toDomain(m transactionModel, version int) (*transaction.Transaction, error) {
	userID, err := shared.UserIDFromString(m.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %w", err)
	}

	currency := shared.Currency(m.Currency)
	if !currency.IsValid() {
		return nil, fmt.Errorf("invalid currency: %s", m.Currency)
	}

	var accountSnapshot *transaction.AccountSnapshot
	if m.AccountName.Valid {
		accountSnapshot = &transaction.AccountSnapshot{
			ID:       m.AccountID,
			Name:     m.AccountName.String,
			Type:     m.AccountType.String,
			Balance:  m.AccountBalance.Float64,
			Currency: shared.Currency(m.AccountCurrency.String),
		}
	}

	var budgetItemSnapshot *transaction.BudgetItemSnapshot
	if m.BudgetItemID != nil && m.BudgetItemCategory.Valid {
		budgetItemSnapshot = &transaction.BudgetItemSnapshot{
			ID:         *m.BudgetItemID,
			Allocation: m.BudgetItemAllocation.Float64,
			Category:   m.BudgetItemCategory.String,
		}
	}

	return transaction.RestoreTransaction(
		m.ID,
		m.Amount,
		m.Date,
		m.Type,
		currency,
		m.Notes,
		m.Files,
		userID,
		m.AccountID,
		m.BudgetItemID,
		m.DeletedAt,
		m.CreatedAt,
		m.UpdatedAt,
		version,
		accountSnapshot,
		budgetItemSnapshot,
	), nil
}
