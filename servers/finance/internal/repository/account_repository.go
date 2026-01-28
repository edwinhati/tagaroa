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

type AccountRepository interface {
	Create(ctx context.Context, account *model.Account) error
	FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Account, error)
	FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Account, error)
	Count(ctx context.Context, where map[string]any) (int, error)
	Update(ctx context.Context, account *model.Account) error
	GetTypeAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error)
	GetCurrencyAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error)
}

type accountRepository struct {
	db *sql.DB
}

func NewAccountRepository(db *sql.DB) AccountRepository {
	return &accountRepository{db: db}
}

/* ----------------------------- Utilities ----------------------------- */

const accountSelectCols = `
	id, name, type, balance, user_id, currency, notes, deleted_at, created_at, updated_at
`

const accountSearchClause = "(LOWER(name) LIKE LOWER($%d) OR LOWER(COALESCE(notes, '')) LIKE LOWER($%d))"

func scanAccount(scanner util.RowScanner) (*model.Account, error) {
	var account model.Account
	var deletedAt sql.NullTime

	if err := scanner.Scan(
		&account.ID, &account.Name, &account.Type, &account.Balance,
		&account.UserID, &account.Currency, &account.Notes, &deletedAt,
		&account.CreatedAt, &account.UpdatedAt,
	); err != nil {
		return nil, err
	}

	if deletedAt.Valid {
		t := deletedAt.Time
		account.DeletedAt = &t
	}

	return &account, nil
}

// Allowlisted columns for ORDER BY to prevent SQL injection
var allowedOrderByColumns = map[string]bool{
	"id":         true,
	"name":       true,
	"type":       true,
	"balance":    true,
	"user_id":    true,
	"currency":   true,
	"notes":      true,
	"deleted_at": true,
	"created_at": true,
	"updated_at": true,
}

// Allowlisted columns for GROUP BY aggregations to prevent SQL injection
var allowedGroupByColumns = map[string]bool{
	"type":     true,
	"currency": true,
}

/* ----------------------------- CRUD ops ------------------------------ */

func (r *accountRepository) Create(ctx context.Context, account *model.Account) error {
	if account.ID == uuid.Nil {
		account.ID = uuid.New()
	}
	now := time.Now()
	account.CreatedAt = now
	account.UpdatedAt = now

	query := `
		INSERT INTO accounts (id, name, type, balance, user_id, currency, notes, deleted_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := r.db.ExecContext(ctx, query,
		account.ID, account.Name, account.Type, account.Balance,
		account.UserID, account.Currency, account.Notes, account.DeletedAt,
		account.CreatedAt, account.UpdatedAt,
	)
	return err
}

func (r *accountRepository) FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Account, error) {
	var sb strings.Builder
	sb.WriteString("SELECT ")
	sb.WriteString(strings.TrimSpace(accountSelectCols))
	sb.WriteString(" FROM accounts")

	whereClause, args := util.BuildWhere(params.Where, util.WhereBuildOpts{
		FieldOrder:           []string{"user_id", "search", "type", "currency"},
		SkipField:            "",   // no skip
		ExcludeDeleted:       true, // always exclude deleted
		SearchClauseTemplate: accountSearchClause,
	})
	sb.WriteString(whereClause)
	sb.WriteString(" LIMIT 1")

	account, err := scanAccount(r.db.QueryRowContext(ctx, sb.String(), args...))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return account, nil
}

func (r *accountRepository) FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Account, error) {
	var sb strings.Builder
	sb.WriteString("SELECT ")
	sb.WriteString(strings.TrimSpace(accountSelectCols))
	sb.WriteString(" FROM accounts")

	whereClause, args := util.BuildWhere(params.Where, util.WhereBuildOpts{
		FieldOrder:           []string{"user_id", "search", "type", "currency"},
		SkipField:            "",   // normal filtering
		ExcludeDeleted:       true, // always exclude deleted
		SearchClauseTemplate: accountSearchClause,
	})
	sb.WriteString(whereClause)

	// ORDER BY - validate to prevent SQL injection
	orderBy, err := util.ValidateOrderBy(params.OrderBy, allowedOrderByColumns)
	if err != nil {
		return nil, fmt.Errorf("invalid ORDER BY clause: %w", err)
	}
	sb.WriteString(" ORDER BY " + orderBy)

	// Pagination (placeholders after WHERE args)
	currIdx := len(args) + 1
	_, args = util.AddOffsetLimit(&sb, params.Offset, params.Limit, currIdx, args)

	rows, err := r.db.QueryContext(ctx, sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []*model.Account
	for rows.Next() {
		account, err := scanAccount(rows)
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, account)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return accounts, nil
}

func (r *accountRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	var sb strings.Builder
	sb.WriteString("SELECT COUNT(*) FROM accounts")

	whereClause, args := util.BuildWhere(where, util.WhereBuildOpts{
		FieldOrder:           []string{"user_id", "search", "type", "currency"},
		SkipField:            "",   // count respects all filters
		ExcludeDeleted:       true, // exclude deleted
		SearchClauseTemplate: accountSearchClause,
	})
	sb.WriteString(whereClause)

	var count int
	if err := r.db.QueryRowContext(ctx, sb.String(), args...).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *accountRepository) Update(ctx context.Context, account *model.Account) error {
	account.UpdatedAt = time.Now()

	query := `
		UPDATE accounts
		SET name = $2, type = $3, balance = $4, currency = $5, notes = $6, deleted_at = $7, updated_at = $8
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query,
		account.ID, account.Name, account.Type, account.Balance,
		account.Currency, account.Notes, account.DeletedAt, account.UpdatedAt,
	)
	return err
}

/* --------------------------- Aggregations ---------------------------- */

func (r *accountRepository) GetTypeAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error) {
	// Skip filtering by "type" while grouping by it
	return r.getAggregations(ctx, "type", "type", []string{"user_id", "search", "currency"}, where)
}

func (r *accountRepository) GetCurrencyAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error) {
	// Skip filtering by "currency" while grouping by it
	return r.getAggregations(ctx, "currency", "currency", []string{"user_id", "search", "type"}, where)
}

func (r *accountRepository) getAggregations(
	ctx context.Context,
	groupBy string,
	skipFilter string,
	fieldOrder []string,
	where map[string]any,
) (map[string]util.AggregationResult, error) {
	// Validate GROUP BY column to prevent SQL injection
	if err := util.ValidateGroupByColumn(groupBy, allowedGroupByColumns); err != nil {
		return nil, fmt.Errorf("invalid aggregation groupBy: %w", err)
	}

	aggs := make(map[string]util.AggregationResult)

	var sb strings.Builder
	sb.WriteString(`
		SELECT
			` + groupBy + ` as key,
			COUNT(*) as count,
			COALESCE(MIN(balance), 0) as min_balance,
			COALESCE(MAX(balance), 0) as max_balance,
			COALESCE(AVG(balance), 0) as avg_balance,
			COALESCE(SUM(balance), 0) as sum_balance
		FROM accounts`)

	whereClause, args := util.BuildWhere(where, util.WhereBuildOpts{
		FieldOrder:           fieldOrder,
		SkipField:            skipFilter, // do not filter on the grouping field
		ExcludeDeleted:       true,
		SearchClauseTemplate: accountSearchClause,
	})
	sb.WriteString(whereClause)
	sb.WriteString(`
		GROUP BY ` + groupBy + `
		ORDER BY ` + groupBy + `
	`)

	rows, err := r.db.QueryContext(ctx, sb.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get %s aggregations: %w", groupBy, err)
	}
	defer rows.Close()

	for rows.Next() {
		var key string
		var res util.AggregationResult
		if err := rows.Scan(&key, &res.Count, &res.Min, &res.Max, &res.Avg, &res.Sum); err != nil {
			return nil, fmt.Errorf("failed to scan %s aggregation: %w", groupBy, err)
		}
		aggs[key] = res
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating %s aggregations: %w", groupBy, err)
	}
	return aggs, nil
}
