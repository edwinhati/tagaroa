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

type AccountRepository interface {
	Create(ctx context.Context, account *model.Account) error
	FindUnique(ctx context.Context, params sharedutil.FindUniqueParams) (*model.Account, error)
	FindMany(ctx context.Context, params sharedutil.FindManyParams) ([]*model.Account, error)
	Count(ctx context.Context, where map[string]any) (int, error)
	Update(ctx context.Context, account *model.Account) error
	GetTypeAggregations(ctx context.Context, where map[string]any) (map[string]sharedutil.AggregationResult, error)
	GetCurrencyAggregations(ctx context.Context, where map[string]any) (map[string]sharedutil.AggregationResult, error)
}

type accountRepository struct {
	db  *sql.DB
	log *zap.SugaredLogger
}

func NewAccountRepository(db *sql.DB) AccountRepository {
	return &accountRepository{
		db:  db,
		log: logger.New().With("repository", "account"),
	}
}

/* ----------------------------- Utilities ----------------------------- */

const accountSelectCols = `
	id, name, type, balance, user_id, currency, notes, deleted_at, created_at, updated_at
`

const accountSearchClause = "(LOWER(name) LIKE LOWER($%d) OR LOWER(COALESCE(notes, '')) LIKE LOWER($%d))"

func scanAccount(scanner sharedutil.RowScanner) (*model.Account, error) {
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
	if err != nil {
		r.log.Errorw("Failed to create account", "error", err, "account_id", account.ID, "user_id", account.UserID)
		return fmt.Errorf("failed to create account: %w", err)
	}
	r.log.Infow("Account created", "account_id", account.ID, "user_id", account.UserID, "type", account.Type)
	return nil
}

func (r *accountRepository) FindUnique(ctx context.Context, params sharedutil.FindUniqueParams) (*model.Account, error) {
	ctx, cancel := util.DBContext(ctx, util.DefaultTimeoutConfig)
	defer cancel()

	var sb strings.Builder
	sb.WriteString("SELECT ")
	sb.WriteString(strings.TrimSpace(accountSelectCols))
	sb.WriteString(" FROM accounts")

	whereClause, args := sharedutil.BuildWhere(params.Where, sharedutil.WhereBuildOpts{
		FieldOrder:           []string{"user_id", "search", "type", "currency"},
		SkipField:            "",
		ExcludeDeleted:       true,
		SearchClauseTemplate: accountSearchClause,
	})
	sb.WriteString(whereClause)
	sb.WriteString(" LIMIT 1")

	account, err := scanAccount(r.db.QueryRowContext(ctx, sb.String(), args...))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		r.log.Errorw("Failed to find unique account", "error", err, "where", params.Where)
		return nil, fmt.Errorf("failed to find account: %w", err)
	}
	r.log.Debugw("Account found", "account_id", account.ID)
	return account, nil
}

func (r *accountRepository) FindMany(ctx context.Context, params sharedutil.FindManyParams) ([]*model.Account, error) {
	ctx, cancel := util.QueryContext(ctx, util.DefaultTimeoutConfig)
	defer cancel()

	var sb strings.Builder
	sb.WriteString("SELECT ")
	sb.WriteString(strings.TrimSpace(accountSelectCols))
	sb.WriteString(" FROM accounts")

	whereClause, args := sharedutil.BuildWhere(params.Where, sharedutil.WhereBuildOpts{
		FieldOrder:           []string{"user_id", "search", "type", "currency"},
		SkipField:            "",
		ExcludeDeleted:       true,
		SearchClauseTemplate: accountSearchClause,
	})
	sb.WriteString(whereClause)

	orderBy, err := sharedutil.ValidateOrderBy(params.OrderBy, allowedOrderByColumns)
	if err != nil {
		return nil, fmt.Errorf("invalid ORDER BY clause: %w", err)
	}
	sb.WriteString(" ORDER BY " + orderBy)

	currIdx := len(args) + 1
	_, args = sharedutil.AddOffsetLimit(&sb, params.Offset, params.Limit, currIdx, args)

	rows, err := r.db.QueryContext(ctx, sb.String(), args...)
	if err != nil {
		r.log.Errorw("Failed to query accounts", "error", err)
		return nil, fmt.Errorf("failed to query accounts: %w", err)
	}
	defer rows.Close()

	var accounts []*model.Account
	for rows.Next() {
		account, err := scanAccount(rows)
		if err != nil {
			r.log.Errorw("Failed to scan account", "error", err)
			return nil, fmt.Errorf("failed to scan account: %w", err)
		}
		accounts = append(accounts, account)
	}
	if err := rows.Err(); err != nil {
		r.log.Errorw("Error iterating accounts", "error", err)
		return nil, fmt.Errorf("error iterating accounts: %w", err)
	}
	r.log.Debugw("Accounts found", "count", len(accounts))
	return accounts, nil
}

func (r *accountRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	ctx, cancel := util.QueryContext(ctx, util.DefaultTimeoutConfig)
	defer cancel()

	var sb strings.Builder
	sb.WriteString("SELECT COUNT(*) FROM accounts")

	whereClause, args := sharedutil.BuildWhere(where, sharedutil.WhereBuildOpts{
		FieldOrder:           []string{"user_id", "search", "type", "currency"},
		SkipField:            "",
		ExcludeDeleted:       true,
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
	ctx, cancel := util.DBContext(ctx, util.DefaultTimeoutConfig)
	defer cancel()

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
	if err != nil {
		r.log.Errorw("Failed to update account", "error", err, "account_id", account.ID)
		return fmt.Errorf("failed to update account: %w", err)
	}
	r.log.Infow("Account updated", "account_id", account.ID)
	return nil
}

/* --------------------------- Aggregations ---------------------------- */

func (r *accountRepository) GetTypeAggregations(ctx context.Context, where map[string]any) (map[string]sharedutil.AggregationResult, error) {
	return r.getAggregations(ctx, "type", "type", []string{"user_id", "search", "currency"}, where)
}

func (r *accountRepository) GetCurrencyAggregations(ctx context.Context, where map[string]any) (map[string]sharedutil.AggregationResult, error) {
	return r.getAggregations(ctx, "currency", "currency", []string{"user_id", "search", "type"}, where)
}

func (r *accountRepository) getAggregations(
	ctx context.Context,
	groupBy string,
	skipFilter string,
	fieldOrder []string,
	where map[string]any,
) (map[string]sharedutil.AggregationResult, error) {
	ctx, cancel := util.QueryContext(ctx, util.DefaultTimeoutConfig)
	defer cancel()

	if err := sharedutil.ValidateGroupByColumn(groupBy, allowedGroupByColumns); err != nil {
		return nil, fmt.Errorf("invalid aggregation groupBy: %w", err)
	}

	aggs := make(map[string]sharedutil.AggregationResult)

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

	whereClause, args := sharedutil.BuildWhere(where, sharedutil.WhereBuildOpts{
		FieldOrder:           fieldOrder,
		SkipField:            skipFilter,
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
