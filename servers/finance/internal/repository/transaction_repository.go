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

// SQL column alias replacements for transaction queries
const (
	colID        = " id"
	colUserID    = " user_id"
	colType      = " type"
	colCurrency  = " currency"
	colDeletedAt = " deleted_at"
	colAccount   = " account"
	colCategory  = " category"

	colTransactionID        = " t.id"
	colTransactionUserID    = " t.user_id"
	colTransactionType      = " t.type"
	colTransactionCurrency  = " t.currency"
	colTransactionDeletedAt = " t.deleted_at"
	colAccountName          = " a.name"
	colBudgetItemCategory   = " bi.category"

	// JOIN clauses
	joinAccounts    = " LEFT JOIN accounts a ON t.account_id = a.id"
	joinBudgetItems = " LEFT JOIN budget_items bi ON t.budget_item_id = bi.id"
)

type TransactionRepository interface {
	Create(ctx context.Context, transaction *model.Transaction) error
	FindUnique(ctx context.Context, params sharedutil.FindUniqueParams) (*model.Transaction, error)
	FindMany(ctx context.Context, params sharedutil.FindManyParams) ([]*model.Transaction, error)
	Count(ctx context.Context, where map[string]any) (int, error)
	Update(ctx context.Context, transaction *model.Transaction) error
	GetTypeAggregations(ctx context.Context, where map[string]any) (map[string]sharedutil.AggregationResult, error)
	GetCurrencyAggregations(ctx context.Context, where map[string]any) (map[string]sharedutil.AggregationResult, error)
	GetAccountAggregations(ctx context.Context, where map[string]any) (map[string]sharedutil.AggregationResult, error)
	GetCategoryAggregations(ctx context.Context, where map[string]any) (map[string]sharedutil.AggregationResult, error)
}

type transactionRepository struct {
	db  *sql.DB
	log *zap.SugaredLogger
}

func NewTransactionRepository(db *sql.DB) TransactionRepository {
	return &transactionRepository{
		db:  db,
		log: logger.New().With("repository", "transaction"),
	}
}

var transactionAllowedOrderByColumns = map[string]bool{
	"id":         true,
	"amount":     true,
	"date":       true,
	"type":       true,
	"currency":   true,
	"created_at": true,
	"updated_at": true,
}

var transactionAllowedGroupByColumns = map[string]bool{
	"type":     true,
	"currency": true,
}

/* ----------------------------- Utilities ----------------------------- */

const transactionSelectCols = `
	t.id, t.amount, t.date, t.type, t.currency, t.notes, t.files, t.user_id, t.deleted_at, t.created_at, t.updated_at, t.account_id, t.budget_item_id,
	a.id, a.name, a.type, a.balance, a.currency,
	bi.id, bi.allocation, bi.category
`

// toPostgresArray converts a string slice to PostgreSQL array literal format
// with proper escaping of special characters
func toPostgresArray(arr []string) string {
	if len(arr) == 0 {
		return "{}"
	}
	escaped := make([]string, len(arr))
	for i, s := range arr {
		// Only quote if contains special characters (comma, quote, backslash, brace, space)
		needsQuoting := strings.ContainsAny(s, `,{"}\ `)
		if needsQuoting {
			// Escape backslashes first, then quotes
			s = strings.ReplaceAll(s, `\`, `\\`)
			s = strings.ReplaceAll(s, `"`, `\"`)
			escaped[i] = `"` + s + `"`
		} else {
			escaped[i] = s
		}
	}
	return "{" + strings.Join(escaped, ",") + "}"
}

func addDateRangeFilters(whereClause string, args []any, where map[string]any) (string, []any) {
	if startDate, ok := where["start_date"]; ok {
		if whereClause == "" {
			whereClause = " WHERE"
		} else {
			whereClause += " AND"
		}
		whereClause += fmt.Sprintf(" t.date >= $%d", len(args)+1)
		args = append(args, startDate)
	}
	if endDate, ok := where["end_date"]; ok {
		if whereClause == "" {
			whereClause = " WHERE"
		} else {
			whereClause += " AND"
		}
		whereClause += fmt.Sprintf(" t.date <= $%d", len(args)+1)
		args = append(args, endDate)
	}
	return whereClause, args
}

func filterDateParams(where map[string]any) map[string]any {
	filtered := make(map[string]any)
	for k, v := range where {
		if k != "start_date" && k != "end_date" {
			filtered[k] = v
		}
	}
	return filtered
}

// applyTransactionColumnAliases replaces generic column names with table-prefixed aliases
func applyTransactionColumnAliases(whereClause string) string {
	whereClause = strings.ReplaceAll(whereClause, colID, colTransactionID)
	whereClause = strings.ReplaceAll(whereClause, colUserID, colTransactionUserID)
	whereClause = strings.ReplaceAll(whereClause, colType, colTransactionType)
	whereClause = strings.ReplaceAll(whereClause, colCurrency, colTransactionCurrency)
	whereClause = strings.ReplaceAll(whereClause, colDeletedAt, colTransactionDeletedAt)
	whereClause = strings.ReplaceAll(whereClause, colAccount, colAccountName)
	whereClause = strings.ReplaceAll(whereClause, colCategory, colBudgetItemCategory)
	return whereClause
}

func scanTransaction(scanner sharedutil.RowScanner) (*model.Transaction, error) {
	var transaction model.Transaction
	var deletedAt sql.NullTime
	var filesStr sql.NullString

	var accountID, accountName, accountType, accountCurrency sql.NullString
	var accountBalance sql.NullFloat64

	var budgetItemID, budgetItemCategory sql.NullString
	var budgetItemAllocation sql.NullFloat64

	var transactionAccountID uuid.UUID
	var transactionBudgetItemID uuid.NullUUID

	if err := scanner.Scan(
		&transaction.ID,
		&transaction.Amount,
		&transaction.Date,
		&transaction.Type,
		&transaction.Currency,
		&transaction.Notes,
		&filesStr,
		&transaction.UserID,
		&deletedAt,
		&transaction.CreatedAt,
		&transaction.UpdatedAt,
		&transactionAccountID,
		&transactionBudgetItemID,
		&accountID,
		&accountName,
		&accountType,
		&accountBalance,
		&accountCurrency,
		&budgetItemID,
		&budgetItemAllocation,
		&budgetItemCategory,
	); err != nil {
		return nil, err
	}

	transaction.AccountID = transactionAccountID
	if transactionBudgetItemID.Valid {
		transaction.BudgetItemID = &transactionBudgetItemID.UUID
	}

	// Parse PostgreSQL array string format
	if filesStr.Valid && filesStr.String != "" {
		// Remove braces and split by comma
		arrayStr := strings.Trim(filesStr.String, "{}")
		if arrayStr != "" {
			transaction.Files = strings.Split(arrayStr, ",")
		}
	}

	if deletedAt.Valid {
		t := deletedAt.Time
		transaction.DeletedAt = &t
	}

	if accountID.Valid {
		id, _ := uuid.Parse(accountID.String)
		transaction.Account = &model.Account{
			ID:       id,
			Name:     accountName.String,
			Type:     model.AccountType(accountType.String),
			Balance:  accountBalance.Float64,
			Currency: accountCurrency.String,
		}
	}

	if budgetItemID.Valid {
		id, _ := uuid.Parse(budgetItemID.String)
		transaction.BudgetItem = &model.BudgetItem{
			ID:         id,
			Allocation: budgetItemAllocation.Float64,
			Category:   budgetItemCategory.String,
		}
	}

	return &transaction, nil
}

/* ----------------------------- CRUD ops ------------------------------ */

func (r *transactionRepository) Create(ctx context.Context, transaction *model.Transaction) error {
	ctx, cancel := util.DBContext(ctx, util.DefaultTimeoutConfig)
	defer cancel()

	if transaction.ID == uuid.Nil {
		transaction.ID = uuid.New()
	}
	now := time.Now()
	transaction.CreatedAt = now
	transaction.UpdatedAt = now

	query := `
		INSERT INTO transactions (id, amount, date, type, currency, notes, files, user_id, account_id, budget_item_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	_, err := r.db.ExecContext(ctx, query,
		transaction.ID,
		transaction.Amount,
		transaction.Date,
		transaction.Type,
		transaction.Currency,
		transaction.Notes,
		toPostgresArray(transaction.Files),
		transaction.UserID,
		transaction.AccountID,
		transaction.BudgetItemID,
		transaction.CreatedAt,
		transaction.UpdatedAt)
	if err != nil {
		r.log.Errorw("Failed to create transaction", "error", err, "transaction_id", transaction.ID, "user_id", transaction.UserID)
		return fmt.Errorf("failed to create transaction: %w", err)
	}
	r.log.Infow("Transaction created", "transaction_id", transaction.ID, "user_id", transaction.UserID, "amount", transaction.Amount, "type", transaction.Type)
	return nil
}

func (r *transactionRepository) FindUnique(ctx context.Context, params sharedutil.FindUniqueParams) (*model.Transaction, error) {
	var sb strings.Builder
	sb.WriteString("SELECT ")
	sb.WriteString(strings.TrimSpace(transactionSelectCols))
	sb.WriteString(" FROM transactions t")
	sb.WriteString(joinAccounts)
	sb.WriteString(joinBudgetItems)

	filteredWhere := filterDateParams(params.Where)
	whereClause, args := sharedutil.BuildWhere(filteredWhere, sharedutil.WhereBuildOpts{
		FieldOrder:     []string{"user_id", "type", "currency"},
		SkipField:      "",
		ExcludeDeleted: true,
	})

	whereClause, args = addDateRangeFilters(whereClause, args, params.Where)
	whereClause = applyTransactionColumnAliases(whereClause)

	sb.WriteString(whereClause)
	sb.WriteString(" LIMIT 1")

	transaction, err := scanTransaction(r.db.QueryRowContext(ctx, sb.String(), args...))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		r.log.Errorw("Failed to find unique transaction", "error", err, "where", params.Where)
		return nil, fmt.Errorf("failed to find transaction: %w", err)
	}
	r.log.Debugw("Transaction found", "transaction_id", transaction.ID)
	return transaction, nil
}

func (r *transactionRepository) FindMany(ctx context.Context, params sharedutil.FindManyParams) ([]*model.Transaction, error) {
	var sb strings.Builder
	sb.WriteString("SELECT ")
	sb.WriteString(strings.TrimSpace(transactionSelectCols))
	sb.WriteString(" FROM transactions t")
	sb.WriteString(joinAccounts)
	sb.WriteString(joinBudgetItems)

	filteredWhere := filterDateParams(params.Where)
	whereClause, args := sharedutil.BuildWhere(filteredWhere, sharedutil.WhereBuildOpts{
		FieldOrder:     []string{"user_id", "type", "currency", "account", "category"},
		SkipField:      "",
		ExcludeDeleted: true,
	})

	whereClause, args = addDateRangeFilters(whereClause, args, params.Where)
	whereClause = applyTransactionColumnAliases(whereClause)

	sb.WriteString(whereClause)

	orderBy, err := sharedutil.ValidateOrderBy(params.OrderBy, transactionAllowedOrderByColumns)
	if err != nil {
		return nil, fmt.Errorf("invalid ORDER BY clause: %w", err)
	}
	sb.WriteString(" ORDER BY t." + orderBy)

	currIdx := len(args) + 1
	_, args = sharedutil.AddOffsetLimit(&sb, params.Offset, params.Limit, currIdx, args)

	rows, err := r.db.QueryContext(ctx, sb.String(), args...)
	if err != nil {
		r.log.Errorw("Failed to query transactions", "error", err)
		return nil, fmt.Errorf("failed to query transactions: %w", err)
	}
	defer rows.Close()

	var transactions []*model.Transaction
	for rows.Next() {
		transaction, err := scanTransaction(rows)
		if err != nil {
			r.log.Errorw("Failed to scan transaction", "error", err)
			return nil, fmt.Errorf("failed to scan transaction: %w", err)
		}
		transactions = append(transactions, transaction)
	}
	if err := rows.Err(); err != nil {
		r.log.Errorw("Error iterating transactions", "error", err)
		return nil, fmt.Errorf("error iterating transactions: %w", err)
	}
	r.log.Debugw("Transactions found", "count", len(transactions))
	return transactions, nil
}

func (r *transactionRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	var sb strings.Builder
	sb.WriteString("SELECT COUNT(*) FROM transactions t")
	sb.WriteString(joinAccounts)
	sb.WriteString(joinBudgetItems)

	filteredWhere := filterDateParams(where)
	whereClause, args := sharedutil.BuildWhere(filteredWhere, sharedutil.WhereBuildOpts{
		FieldOrder:     []string{"user_id", "type", "currency", "account", "category"},
		SkipField:      "",
		ExcludeDeleted: true,
	})

	whereClause, args = addDateRangeFilters(whereClause, args, where)
	whereClause = applyTransactionColumnAliases(whereClause)

	sb.WriteString(whereClause)

	var count int
	if err := r.db.QueryRowContext(ctx, sb.String(), args...).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *transactionRepository) Update(ctx context.Context, transaction *model.Transaction) error {
	transaction.UpdatedAt = time.Now()

	query := `
		UPDATE transactions
		SET amount = $2, date = $3, currency = $4, type = $5, notes = $6, files = $7, account_id = $8, budget_item_id = $9, deleted_at = $10, updated_at = $11
		WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query,
		transaction.ID,
		transaction.Amount,
		transaction.Date,
		transaction.Currency,
		transaction.Type,
		transaction.Notes,
		toPostgresArray(transaction.Files),
		transaction.AccountID,
		transaction.BudgetItemID,
		transaction.DeletedAt,
		transaction.UpdatedAt)

	if err != nil {
		r.log.Errorw("Failed to update transaction", "error", err, "transaction_id", transaction.ID)
		return fmt.Errorf("failed to update transaction: %w", err)
	}
	r.log.Infow("Transaction updated", "transaction_id", transaction.ID)
	return nil
}

/* --------------------------- Aggregations ---------------------------- */

func (r *transactionRepository) GetTypeAggregations(ctx context.Context, where map[string]any) (map[string]sharedutil.AggregationResult, error) {
	return r.getAggregations(ctx, "t.type", "type", []string{"user_id", "currency", "account", "category"}, where)
}

func (r *transactionRepository) GetCurrencyAggregations(ctx context.Context, where map[string]any) (map[string]sharedutil.AggregationResult, error) {
	return r.getAggregations(ctx, "t.currency", "currency", []string{"user_id", "type", "account", "category"}, where)
}

func (r *transactionRepository) GetAccountAggregations(ctx context.Context, where map[string]any) (map[string]sharedutil.AggregationResult, error) {
	return r.getAggregations(ctx, "a.name", "account", []string{"user_id", "type", "currency", "category"}, where)
}

func (r *transactionRepository) GetCategoryAggregations(ctx context.Context, where map[string]any) (map[string]sharedutil.AggregationResult, error) {
	return r.getAggregations(ctx, "bi.category", "category", []string{"user_id", "type", "currency", "account"}, where)
}

func (r *transactionRepository) getAggregations(
	ctx context.Context,
	groupBy string,
	skipFilter string,
	fieldOrder []string,
	where map[string]any,
) (map[string]sharedutil.AggregationResult, error) {
	if !strings.Contains(groupBy, ".") {
		if err := sharedutil.ValidateGroupByColumn(groupBy, transactionAllowedGroupByColumns); err != nil {
			return nil, fmt.Errorf("invalid aggregation groupBy: %w", err)
		}
	}

	aggs := make(map[string]sharedutil.AggregationResult)

	var sb strings.Builder
	sb.WriteString(`
		SELECT
			` + groupBy + ` as key,
			COUNT(*) as count,
			COALESCE(MIN(t.amount), 0) as min_amount,
			COALESCE(MAX(t.amount), 0) as max_amount,
			COALESCE(AVG(t.amount), 0) as avg_amount,
			COALESCE(SUM(t.amount), 0) as sum_amount
		FROM transactions t`)
	sb.WriteString(joinAccounts)
	sb.WriteString(joinBudgetItems)

	filteredWhere := filterDateParams(where)
	whereClause, args := sharedutil.BuildWhere(filteredWhere, sharedutil.WhereBuildOpts{
		FieldOrder:     fieldOrder,
		SkipField:      skipFilter,
		ExcludeDeleted: true,
	})

	whereClause, args = addDateRangeFilters(whereClause, args, where)
	whereClause = applyTransactionColumnAliases(whereClause)

	sb.WriteString(whereClause)

	if strings.Contains(groupBy, "a.") || strings.Contains(groupBy, "bi.") {
		sb.WriteString(` AND ` + groupBy + ` IS NOT NULL`)
	}

	sb.WriteString(`
		GROUP BY ` + groupBy + `
		ORDER BY ` + groupBy + `
	`)

	rows, err := r.db.QueryContext(ctx, sb.String(), args...)
	if err != nil {
		r.log.Errorw("Failed to get aggregations", "error", err, "group_by", groupBy)
		return nil, fmt.Errorf("failed to get %s aggregations: %w", groupBy, err)
	}
	defer rows.Close()

	for rows.Next() {
		var key string
		var res sharedutil.AggregationResult
		if err := rows.Scan(&key, &res.Count, &res.Min, &res.Max, &res.Avg, &res.Sum); err != nil {
			r.log.Errorw("Failed to scan aggregation", "error", err, "group_by", groupBy)
			return nil, fmt.Errorf("failed to scan %s aggregation: %w", groupBy, err)
		}
		aggs[key] = res
	}
	if err := rows.Err(); err != nil {
		r.log.Errorw("Error iterating aggregations", "error", err, "group_by", groupBy)
		return nil, fmt.Errorf("error iterating %s aggregations: %w", groupBy, err)
	}
	r.log.Debugw("Aggregations computed", "group_by", groupBy, "keys_count", len(aggs))
	return aggs, nil
}
