package repository

import (
	"context"
	"database/sql"
	"fmt"
	"slices"
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

type whereBuildOpts struct {
	fieldOrder     []string // known fields in deterministic order
	skipField      string   // exclude this field from filtering (for aggregations)
	excludeDeleted bool     // always enforce is_deleted=false
}

// buildWhere constructs a WHERE clause and args with:
// - deterministic processing order
// - special handling for "search" across (name, notes) with LOWER/COALESCE
// - slice values → IN (...)
// - ability to skip a field (e.g., skip "type" when aggregating by type)
func buildWhere(where map[string]any, opts whereBuildOpts) (clause string, args []any) {
	var conditions []string
	argIndex := 1

	if opts.excludeDeleted {
		conditions = append(conditions, "is_deleted = false")
	}

	if where == nil {
		if len(conditions) > 0 {
			return " WHERE " + strings.Join(conditions, " AND "), nil
		}
		return "", nil
	}

	processed := map[string]struct{}{}

	processField := func(field string, value any) {
		if field == opts.skipField {
			return // skip filtering on the field we aggregate by
		}

		switch field {
		case "search":
			searchTerm := fmt.Sprintf("%%%v%%", value)
			conditions = append(conditions,
				fmt.Sprintf("(LOWER(name) LIKE LOWER($%d) OR LOWER(COALESCE(notes, '')) LIKE LOWER($%d))", argIndex, argIndex),
			)
			args = append(args, searchTerm)
			argIndex++
		default:
			// []string → IN (...)
			if slice, ok := value.([]string); ok && len(slice) > 0 {
				placeholders := make([]string, len(slice))
				for i := range slice {
					placeholders[i] = fmt.Sprintf("$%d", argIndex)
					args = append(args, slice[i])
					argIndex++
				}
				conditions = append(conditions, fmt.Sprintf("%s IN (%s)", field, strings.Join(placeholders, ",")))
			} else {
				conditions = append(conditions, fmt.Sprintf("%s = $%d", field, argIndex))
				args = append(args, value)
				argIndex++
			}
		}
	}

	// First: known fields in stable order
	for _, field := range opts.fieldOrder {
		if value, ok := where[field]; ok {
			processField(field, value)
			processed[field] = struct{}{}
		}
	}
	// Then: any remaining fields
	for field, value := range where {
		if field == opts.skipField || slices.Contains(opts.fieldOrder, field) {
			continue
		}
		processField(field, value)
	}

	if len(conditions) == 0 {
		return "", args
	}
	return " WHERE " + strings.Join(conditions, " AND "), args
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
		skipField:      "",    // no skip
		excludeDeleted: true,  // always exclude deleted
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

	// ORDER BY
	if params.OrderBy != "" {
		sb.WriteString(" ORDER BY " + params.OrderBy)
	} else {
		sb.WriteString(" ORDER BY created_at DESC")
	}

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