package util

import (
	"fmt"
	"strings"
)

type FindManyParams struct {
	Offset  int
	Limit   int
	Where   map[string]any
	OrderBy string
}

type FindUniqueParams struct {
	Where map[string]any
}

type AggregationResult struct {
	Count int     `json:"count"`
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
	Avg   float64 `json:"avg"`
	Sum   float64 `json:"sum"`
}

type RowScanner interface {
	Scan(dest ...any) error
}

/* ----------------------------- Pagination -------------------------------- */
func AddOffsetLimit(sb *strings.Builder, offset, limit int, currArgIdx int, args []any) (int, []any) {
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

/* ----------------------------- Where Builder ----------------------------- */

const (
	whereKeyword        = " WHERE "
	equalsClauseFormat  = "%s = $%d"
	inClauseFormat      = "%s IN (%s)"
	searchLikeFormat    = "%%%v%%"
	notDeletedCondition = "deleted_at IS NULL"
)

type WhereBuildOpts struct {
	FieldOrder           []string // known fields in deterministic order
	SkipField            string   // exclude this field from filtering (for aggregations)
	ExcludeDeleted       bool     // always enforce deleted_at IS NULL
	SearchClauseTemplate string   // template for search condition
}

type whereBuilder struct {
	conditions []string
	args       []any
	argIndex   int
	opts       WhereBuildOpts
	processed  map[string]struct{}
}

func newWhereBuilder(opts WhereBuildOpts) *whereBuilder {
	builder := &whereBuilder{
		argIndex:  1,
		opts:      opts,
		processed: make(map[string]struct{}),
	}
	if opts.ExcludeDeleted {
		builder.conditions = append(builder.conditions, notDeletedCondition)
	}
	return builder
}

func (b *whereBuilder) addSearchCondition(searchConditionTemplate string, value any) {
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

func (b *whereBuilder) processField(searchClauseTemplate, field string, value any) {
	if field == b.opts.SkipField {
		return
	}

	b.processed[field] = struct{}{}

	if field == "search" {
		b.addSearchCondition(searchClauseTemplate, value)
		return
	}

	if slice, ok := value.([]string); ok {
		if len(slice) == 0 {
			b.addEqualsCondition(field, value)
		} else {
			b.addSliceCondition(field, slice)
		}
		return
	}

	b.addEqualsCondition(field, value)
}

func (b *whereBuilder) process(where map[string]any) {
	if where == nil {
		return
	}
	for _, field := range b.opts.FieldOrder {
		if value, ok := where[field]; ok {
			b.processField(b.opts.SearchClauseTemplate, field, value)
		}
	}
	for field, value := range where {
		if field == b.opts.SkipField {
			continue
		}
		if _, seen := b.processed[field]; seen {
			continue
		}
		b.processField(b.opts.SearchClauseTemplate, field, value)
	}
}

func (b *whereBuilder) clause() (string, []any) {
	if len(b.conditions) == 0 {
		return "", b.args
	}
	return whereKeyword + strings.Join(b.conditions, " AND "), b.args
}

// BuildWhere constructs a WHERE clause and args with:
// - deterministic processing order
// - special handling for "search" across (name, notes) with LOWER/COALESCE
// - slice values → IN (...)
// - ability to skip a field (e.g., skip "type" when aggregating by type)
func BuildWhere(where map[string]any, opts WhereBuildOpts) (clause string, args []any) {
	builder := newWhereBuilder(opts)
	builder.process(where)
	return builder.clause()
}

// validateOrderBy validates and sanitizes ORDER BY clause to prevent SQL injection
func ValidateOrderBy(orderBy string, allowedOrderByColumns map[string]bool) (string, error) {
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
func ValidateGroupByColumn(column string, allowedGroupByColumns map[string]bool) error {
	if !allowedGroupByColumns[column] {
		return fmt.Errorf("invalid GROUP BY column: %s", column)
	}
	return nil
}
