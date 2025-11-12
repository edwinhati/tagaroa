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
	id, name, type, balance, user_id, currency, notes, is_deleted, created_at, updated_at
`

const (
	whereKeyword            = " WHERE "
	equalsClauseFormat      = "%s = $%d"
	inClauseFormat          = "%s IN (%s)"
	searchConditionTemplate = "(LOWER(name) LIKE LOWER($%d) OR LOWER(COALESCE(notes, '')) LIKE LOWER($%d))"
	searchLikeFormat        = "%%%v%%"
	isDeletedCondition      = "is_deleted = false"
)

// Allowlisted columns for ORDER BY to prevent SQL injection
var allowedOrderByColumns = map[string]bool{
	"id":         true,
	"name":       true,
	"type":       true,
	"balance":    true,
	"user_id":    true,
	"currency":   true,
	"notes":      true,
	"created_at": true,
	"updated_at": true,
}

// Allowlisted columns for GROUP BY aggregations to prevent SQL injection
var allowedGroupByColumns = map[string]bool{
	"type":     true,
	"currency": true,
}

type whereBuildOpts struct {
	fieldOrder     []string // known fields in deterministic order
	skipField      string   // exclude this field from filtering (for aggregations)
	excludeDeleted bool     // always enforce is_deleted=false
}

type whereBuilder struct {
	conditions []string
	args       []any
	argIndex   int
	opts       whereBuildOpts
	processed  map[string]struct{}
}

func newWhereBuilder(opts whereBuildOpts) *whereBuilder {
	builder := &whereBuilder{
		argIndex:  1,
		opts:      opts,
		processed: make(map[string]struct{}),
	}
	if opts.excludeDeleted {
		builder.conditions = append(builder.conditions, isDeletedCondition)
	}
	return builder
}

func (b *whereBuilder) addSearchCondition(value any) {
	searchTerm := fmt.Sprintf(searchLikeFormat, value)
	b.conditions = append(
		b.conditions,
		fmt.Sprintf(searchConditionTemplate, b.argIndex, b.argIndex),
	)
	b.args = append(b.args, searchTerm)
	b.argIndex++
}

func (b *whereBuilder) addSliceCondition(field string, slice []string) {
	if len(slice) == 0 {
		return
	}
	placeholders := make([]string, len(slice))
	for i := range slice {
		placeholders[i] = fmt.Sprintf("$%d", b.argIndex)
		b.args = append(b.args, slice[i])
		b.argIndex++
	}
	b.conditions = append(
		b.conditions,
		fmt.Sprintf(inClauseFormat, field, strings.Join(placeholders, ",")),
	)
}

func (b *whereBuilder) addEqualsCondition(field string, value any) {
	b.conditions = append(
		b.conditions,
		fmt.Sprintf(equalsClauseFormat, field, b.argIndex),
	)
	b.args = append(b.args, value)
	b.argIndex++
}

func (b *whereBuilder) processField(field string, value any) {
	if field == b.opts.skipField {
		return
	}

	b.processed[field] = struct{}{}

	if field == "search" {
		b.addSearchCondition(value)
		return
	}

	if slice, ok := value.([]string); ok {
		b.addSliceCondition(field, slice)
		return
	}

	b.addEqualsCondition(field, value)
}

func (b *whereBuilder) process(where map[string]any) {
	if where == nil {
		return
	}
	for _, field := range b.opts.fieldOrder {
		if value, ok := where[field]; ok {
			b.processField(field, value)
		}
	}
	for field, value := range where {
		if field == b.opts.skipField {
			continue
		}
		if _, seen := b.processed[field]; seen {
			continue
		}
		b.processField(field, value)
	}
}

func (b *whereBuilder) clause() (string, []any) {
	if len(b.conditions) == 0 {
		return "", b.args
	}
	return whereKeyword + strings.Join(b.conditions, " AND "), b.args
}

// buildWhere constructs a WHERE clause and args with:
// - deterministic processing order
// - special handling for "search" across (name, notes) with LOWER/COALESCE
// - slice values → IN (...)
// - ability to skip a field (e.g., skip "type" when aggregating by type)
func buildWhere(where map[string]any, opts whereBuildOpts) (clause string, args []any) {
	builder := newWhereBuilder(opts)
	builder.process(where)
	return builder.clause()
}

// addOffsetLimit appends OFFSET/LIMIT placeholders preserving correct arg indexes.
func addOffsetLimit(sb *strings.Builder, offset, limit int, currArgIdx int, args []any) (int, []any) {
	if offset > 0 {
		sb.WriteString(fmt.Sprintf(" OFFSET $%d", currArgIdx))
		args = append(args, offset)
		currArgIdx++
	}
	if limit > 0 {
		sb.WriteString(fmt.Sprintf(" LIMIT $%d", currArgIdx))
		args = append(args, limit)
		currArgIdx++
	}
	return currArgIdx, args
}

// validateOrderBy validates and sanitizes ORDER BY clause to prevent SQL injection
func validateOrderBy(orderBy string) (string, error) {
	if orderBy == "" {
		return "created_at DESC", nil
	}

	// Parse ORDER BY clause (column [ASC|DESC])
	parts := strings.Fields(strings.TrimSpace(orderBy))
	if len(parts) == 0 {
		return "created_at DESC", nil
	}

	column := parts[0]
	if !allowedOrderByColumns[column] {
		return "", fmt.Errorf("invalid ORDER BY column: %s", column)
	}

	// Default to ASC if no direction specified
	direction := "ASC"
	if len(parts) > 1 {
		dir := strings.ToUpper(parts[1])
		if dir == "DESC" || dir == "ASC" {
			direction = dir
		} else {
			return "", fmt.Errorf("invalid ORDER BY direction: %s", parts[1])
		}
	}

	return fmt.Sprintf("%s %s", column, direction), nil
}

// validateGroupByColumn validates GROUP BY column to prevent SQL injection
func validateGroupByColumn(column string) error {
	if !allowedGroupByColumns[column] {
		return fmt.Errorf("invalid GROUP BY column: %s", column)
	}
	return nil
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
		INSERT INTO accounts (id, name, type, balance, user_id, currency, notes, is_deleted, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := r.db.ExecContext(ctx, query,
		account.ID, account.Name, account.Type, account.Balance,
		account.UserID, account.Currency, account.Notes, account.IsDeleted,
		account.CreatedAt, account.UpdatedAt,
	)
	return err
}

func (r *accountRepository) FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Account, error) {
	var sb strings.Builder
	sb.WriteString("SELECT ")
	sb.WriteString(strings.TrimSpace(accountSelectCols))
	sb.WriteString(" FROM accounts")

	whereClause, args := buildWhere(params.Where, whereBuildOpts{
		fieldOrder:     []string{"user_id", "search", "type", "currency"},
		skipField:      "",   // no skip
		excludeDeleted: true, // always exclude deleted
	})
	sb.WriteString(whereClause)
	sb.WriteString(" LIMIT 1")

	var account model.Account
	err := r.db.QueryRowContext(ctx, sb.String(), args...).Scan(
		&account.ID, &account.Name, &account.Type, &account.Balance,
		&account.UserID, &account.Currency, &account.Notes, &account.IsDeleted,
		&account.CreatedAt, &account.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &account, nil
}

func (r *accountRepository) FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Account, error) {
	var sb strings.Builder
	sb.WriteString("SELECT ")
	sb.WriteString(strings.TrimSpace(accountSelectCols))
	sb.WriteString(" FROM accounts")

	whereClause, args := buildWhere(params.Where, whereBuildOpts{
		fieldOrder:     []string{"user_id", "search", "type", "currency"},
		skipField:      "",   // normal filtering
		excludeDeleted: true, // always exclude deleted
	})
	sb.WriteString(whereClause)

	// ORDER BY - validate to prevent SQL injection
	orderBy, err := validateOrderBy(params.OrderBy)
	if err != nil {
		return nil, fmt.Errorf("invalid ORDER BY clause: %w", err)
	}
	sb.WriteString(" ORDER BY " + orderBy)

	// Pagination (placeholders after WHERE args)
	currIdx := len(args) + 1
	currIdx, args = addOffsetLimit(&sb, params.Offset, params.Limit, currIdx, args)

	rows, err := r.db.QueryContext(ctx, sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []*model.Account
	for rows.Next() {
		var a model.Account
		if err := rows.Scan(
			&a.ID, &a.Name, &a.Type, &a.Balance,
			&a.UserID, &a.Currency, &a.Notes, &a.IsDeleted,
			&a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		accounts = append(accounts, &a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return accounts, nil
}

func (r *accountRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	var sb strings.Builder
	sb.WriteString("SELECT COUNT(*) FROM accounts")

	whereClause, args := buildWhere(where, whereBuildOpts{
		fieldOrder:     []string{"user_id", "search", "type", "currency"},
		skipField:      "",   // count respects all filters
		excludeDeleted: true, // exclude deleted
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
		SET name = $2, type = $3, balance = $4, currency = $5, notes = $6, is_deleted = $7, updated_at = $8
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query,
		account.ID, account.Name, account.Type, account.Balance,
		account.Currency, account.Notes, account.IsDeleted, account.UpdatedAt,
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
	if err := validateGroupByColumn(groupBy); err != nil {
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

	whereClause, args := buildWhere(where, whereBuildOpts{
		fieldOrder:     fieldOrder,
		skipField:      skipFilter, // do not filter on the grouping field
		excludeDeleted: true,
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
