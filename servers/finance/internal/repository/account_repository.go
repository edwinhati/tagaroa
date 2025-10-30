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
	return &accountRepository{
		db: db,
	}
}

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
	// Build the base query
	query := `SELECT id, name, type, balance, user_id, currency, notes, is_deleted, created_at, updated_at FROM accounts`
	var conditions []string
	var args []any
	argIndex := 1

	// Always filter out deleted records
	conditions = append(conditions, "is_deleted = false")

	// Apply dynamic where conditions
	if params.Where != nil {
		for field, value := range params.Where {
			conditions = append(conditions, fmt.Sprintf("%s = $%d", field, argIndex))
			args = append(args, value)
			argIndex++
		}
	}

	// Add WHERE clause
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	// Add LIMIT 1 for unique result
	query += " LIMIT 1"

	var account model.Account
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
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
	// Build the base query
	query := `SELECT id, name, type, balance, user_id, currency, notes, is_deleted, created_at, updated_at FROM accounts`
	var conditions []string
	var args []any
	argIndex := 1

	// Always filter out deleted records
	conditions = append(conditions, "is_deleted = false")

	// Apply dynamic where conditions
	if params.Where != nil {
		for field, value := range params.Where {
			if field == "search" {
				// Handle search across name and notes fields
				searchTerm := fmt.Sprintf("%%%s%%", value)
				conditions = append(conditions, fmt.Sprintf("(LOWER(name) LIKE LOWER($%d) OR LOWER(COALESCE(notes, '')) LIKE LOWER($%d))", argIndex, argIndex))
				args = append(args, searchTerm)
				argIndex++
			} else if slice, ok := value.([]string); ok && len(slice) > 0 {
				placeholders := make([]string, len(slice))
				for i, v := range slice {
					placeholders[i] = fmt.Sprintf("$%d", argIndex)
					args = append(args, v)
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

	// Add WHERE clause if we have conditions
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	// Apply ordering
	if params.OrderBy != "" {
		query += " ORDER BY " + params.OrderBy
	} else {
		query += " ORDER BY created_at DESC" // Default ordering
	}

	// Apply pagination
	if params.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIndex)
		args = append(args, params.Offset)
		argIndex++
	}
	if params.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIndex)
		args = append(args, params.Limit)
		argIndex++
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []*model.Account
	for rows.Next() {
		var account model.Account
		err := rows.Scan(
			&account.ID, &account.Name, &account.Type, &account.Balance,
			&account.UserID, &account.Currency, &account.Notes, &account.IsDeleted,
			&account.CreatedAt, &account.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, &account)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return accounts, nil
}

func (r *accountRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	// Build the base query
	query := `SELECT COUNT(*) FROM accounts`
	var conditions []string
	var args []any
	argIndex := 1

	// Always filter out deleted records
	conditions = append(conditions, "is_deleted = false")

	// Apply dynamic where conditions
	for field, value := range where {
		if field == "search" {
			// Handle search across name and notes fields
			searchTerm := fmt.Sprintf("%%%s%%", value)
			conditions = append(conditions, fmt.Sprintf("(LOWER(name) LIKE LOWER($%d) OR LOWER(COALESCE(notes, '')) LIKE LOWER($%d))", argIndex, argIndex))
			args = append(args, searchTerm)
			argIndex++
		} else if slice, ok := value.([]string); ok && len(slice) > 0 {
			placeholders := make([]string, len(slice))
			for i, v := range slice {
				placeholders[i] = fmt.Sprintf("$%d", argIndex)
				args = append(args, v)
				argIndex++
			}
			conditions = append(conditions, fmt.Sprintf("%s IN (%s)", field, strings.Join(placeholders, ",")))
		} else {
			conditions = append(conditions, fmt.Sprintf("%s = $%d", field, argIndex))
			args = append(args, value)
			argIndex++
		}
	}

	// Add WHERE clause if we have conditions
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	var count int
	err := r.db.QueryRowContext(ctx, query, args...).Scan(&count)
	if err != nil {
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

func (r *accountRepository) GetTypeAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error) {
	aggregations := make(map[string]util.AggregationResult)

	// Base conditions
	var conditions []string
	var args []any
	argIndex := 1

	// Always filter out deleted records
	conditions = append(conditions, "is_deleted = false")

	// Apply dynamic where conditions (excluding type field for type aggregations)
	for field, value := range where {
		if field == "type" {
			continue // Skip type filtering for type aggregations
		}
		if field == "search" {
			// Handle search across name and notes fields
			searchTerm := fmt.Sprintf("%%%s%%", value)
			conditions = append(conditions, fmt.Sprintf("(LOWER(name) LIKE LOWER($%d) OR LOWER(COALESCE(notes, '')) LIKE LOWER($%d))", argIndex, argIndex))
			args = append(args, searchTerm)
			argIndex++
		} else if slice, ok := value.([]string); ok && len(slice) > 0 {
			placeholders := make([]string, len(slice))
			for i, v := range slice {
				placeholders[i] = fmt.Sprintf("$%d", argIndex)
				args = append(args, v)
				argIndex++
			}
			conditions = append(conditions, fmt.Sprintf("%s IN (%s)", field, strings.Join(placeholders, ",")))
		} else {
			conditions = append(conditions, fmt.Sprintf("%s = $%d", field, argIndex))
			args = append(args, value)
			argIndex++
		}
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	// Aggregate by account type
	typeQuery := `
		SELECT
			type as key,
			COUNT(*) as count,
			COALESCE(MIN(balance), 0) as min_balance,
			COALESCE(MAX(balance), 0) as max_balance,
			COALESCE(AVG(balance), 0) as avg_balance,
			COALESCE(SUM(balance), 0) as sum_balance
		FROM accounts` + whereClause + `
		GROUP BY type
		ORDER BY type
	`

	typeRows, err := r.db.QueryContext(ctx, typeQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get type aggregations: %w", err)
	}
	defer typeRows.Close()

	for typeRows.Next() {
		var key string
		var result util.AggregationResult
		err := typeRows.Scan(&key, &result.Count, &result.Min, &result.Max, &result.Avg, &result.Sum)
		if err != nil {
			return nil, fmt.Errorf("failed to scan type aggregation: %w", err)
		}
		aggregations[key] = result
	}

	if err = typeRows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating type aggregations: %w", err)
	}

	return aggregations, nil
}

func (r *accountRepository) GetCurrencyAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error) {
	aggregations := make(map[string]util.AggregationResult)

	// Base conditions
	var conditions []string
	var args []any
	argIndex := 1

	// Always filter out deleted records
	conditions = append(conditions, "is_deleted = false")

	// Apply dynamic where conditions (excluding currency field for currency aggregations)
	for field, value := range where {
		if field == "currency" {
			continue // Skip currency filtering for currency aggregations
		}
		if field == "search" {
			// Handle search across name and notes fields
			searchTerm := fmt.Sprintf("%%%s%%", value)
			conditions = append(conditions, fmt.Sprintf("(LOWER(name) LIKE LOWER($%d) OR LOWER(COALESCE(notes, '')) LIKE LOWER($%d))", argIndex, argIndex))
			args = append(args, searchTerm)
			argIndex++
		} else if slice, ok := value.([]string); ok && len(slice) > 0 {
			placeholders := make([]string, len(slice))
			for i, v := range slice {
				placeholders[i] = fmt.Sprintf("$%d", argIndex)
				args = append(args, v)
				argIndex++
			}
			conditions = append(conditions, fmt.Sprintf("%s IN (%s)", field, strings.Join(placeholders, ",")))
		} else {
			conditions = append(conditions, fmt.Sprintf("%s = $%d", field, argIndex))
			args = append(args, value)
			argIndex++
		}
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	// Aggregate by account currency
	currencyQuery := `
		SELECT
			currency as key,
			COUNT(*) as count,
			COALESCE(MIN(balance), 0) as min_balance,
			COALESCE(MAX(balance), 0) as max_balance,
			COALESCE(AVG(balance), 0) as avg_balance,
			COALESCE(SUM(balance), 0) as sum_balance
		FROM accounts` + whereClause + `
		GROUP BY currency
		ORDER BY currency
	`

	currencyRows, err := r.db.QueryContext(ctx, currencyQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get currency aggregations: %w", err)
	}
	defer currencyRows.Close()

	for currencyRows.Next() {
		var key string
		var result util.AggregationResult
		err := currencyRows.Scan(&key, &result.Count, &result.Min, &result.Max, &result.Avg, &result.Sum)
		if err != nil {
			return nil, fmt.Errorf("failed to scan currency aggregation: %w", err)
		}
		aggregations[key] = result
	}

	if err = currencyRows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating currency aggregations: %w", err)
	}

	return aggregations, nil
}
