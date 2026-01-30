package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/service"
	"github.com/google/uuid"
)

const (
	defaultOrderByClause = "created_at DESC"
	minQueryLimit        = 5
	maxQueryLimit        = 50

	// Error messages
	errMsgAccessDenied                 = "Access denied"
	errMsgTransactionNotFound          = "Transaction not found"
	errMsgTransactionAccessDenied      = "You don't have permission to access this transaction"
	errMsgFailedToGetTransaction       = "Failed to get transaction"
	errMsgFailedToUpdateTransaction    = "Failed to update transaction"
	errMsgFailedToDeleteTransaction    = "Failed to delete transaction"
	errMsgAccountNotFound              = "Account not found"
	errMsgAccountAccessDenied          = "You don't have permission to access this account"
	errMsgFailedToGetAccount           = "Failed to get account"
	errMsgFailedToUpdateAccount        = "Failed to update account"
	errMsgFailedToDeleteAccount        = "Failed to delete account"
	errMsgBudgetNotFound               = "Budget not found"
	errMsgBudgetAccessDenied           = "You don't have permission to access this budget"
	errMsgBudgetUpdateAccessDenied     = "You don't have permission to update this budget"
	errMsgBudgetItemUpdateAccessDenied = "You don't have permission to update this budget item"
	errMsgFailedToGetBudget            = "Failed to get budget"
	errMsgFailedToUpdateBudget         = "Failed to update budget"
	errMsgFailedToUpdateBudgetItem     = "Failed to update budget item"
)

func buildAccountQueryParams(r *http.Request, userID uuid.UUID) service.GetAccountsParams {
	query := r.URL.Query()
	return service.GetAccountsParams{
		UserID:     userID,
		Page:       util.GetQueryInt(r, "page", 1),
		Types:      parseQueryValues(query["type"]),
		Currencies: parseQueryValues(query["currency"]),
		Search:     strings.TrimSpace(query.Get("search")),
		Limit:      clampLimit(util.GetQueryInt(r, "limit", minQueryLimit)),
		OrderBy:    pickOrderBy(query.Get("order_by")),
	}
}

func buildTransactionQueryParams(r *http.Request, userID uuid.UUID) service.GetTransactionsParams {
	query := r.URL.Query()

	var startDate, endDate *time.Time
	if startStr := query.Get("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			startDate = &parsed
		}
	}
	if endStr := query.Get("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			// Set time to end of day to include all transactions on this day
			endOfDay := parsed.Add(24 * time.Hour).Add(-1 * time.Nanosecond)
			endDate = &endOfDay
		}
	}

	return service.GetTransactionsParams{
		UserID:     userID,
		Page:       util.GetQueryInt(r, "page", 1),
		Types:      parseQueryValues(query["type"]),
		Currencies: parseQueryValues(query["currency"]),
		Accounts:   parseQueryValues(query["account"]),
		Categories: parseQueryValues(query["category"]),
		StartDate:  startDate,
		EndDate:    endDate,
		Limit:      clampLimit(util.GetQueryInt(r, "limit", minQueryLimit)),
		OrderBy:    pickOrderBy(query.Get("order_by")),
	}
}

func buildBudgetQueryParams(r *http.Request, userID uuid.UUID) service.GetBudgetsParams {
	return service.GetBudgetsParams{
		UserID: userID,
		Page:   util.GetQueryInt(r, "page", 1),
		Limit:  clampLimit(util.GetQueryInt(r, "limit", minQueryLimit)),
	}
}

func parseQueryValues(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	var parsed []string
	for _, value := range values {
		for part := range strings.SplitSeq(value, ",") {
			if trimmed := strings.TrimSpace(part); trimmed != "" {
				parsed = append(parsed, trimmed)
			}
		}
	}
	return parsed
}

func pickOrderBy(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return defaultOrderByClause
	}
	return raw
}

func clampLimit(value int) int {
	switch {
	case value <= 0:
		return minQueryLimit
	case value < minQueryLimit:
		return minQueryLimit
	case value > maxQueryLimit:
		return maxQueryLimit
	default:
		return value
	}
}

func convertAggregations(result *service.GetAccountsResult) *util.Aggregations {
	if result == nil {
		return nil
	}

	aggregationsMap := make(util.Aggregations)
	if buckets := convertAggregationResults(result.TypeAggregations); len(buckets) > 0 {
		aggregationsMap["type"] = buckets
	}
	if buckets := convertAggregationResults(result.CurrencyAggregations); len(buckets) > 0 {
		aggregationsMap["currency"] = buckets
	}

	if len(aggregationsMap) == 0 {
		return nil
	}
	return &aggregationsMap
}

func convertTransactionAggregations(result *service.GetTransactionsResult) *util.Aggregations {
	if result == nil {
		return nil
	}

	aggregationsMap := make(util.Aggregations)
	if buckets := convertAggregationResults(result.TypeAggregations); len(buckets) > 0 {
		aggregationsMap["type"] = buckets
	}
	if buckets := convertAggregationResults(result.CurrencyAggregations); len(buckets) > 0 {
		aggregationsMap["currency"] = buckets
	}
	if buckets := convertAggregationResults(result.AccountAggregations); len(buckets) > 0 {
		aggregationsMap["account"] = buckets
	}
	if buckets := convertAggregationResults(result.CategoryAggregations); len(buckets) > 0 {
		aggregationsMap["category"] = buckets
	}

	if len(aggregationsMap) == 0 {
		return nil
	}
	return &aggregationsMap
}

func convertAggregationResults(source map[string]util.AggregationResult) []util.Bucket {
	if len(source) == 0 {
		return nil
	}

	buckets := make([]util.Bucket, 0, len(source))
	for key, agg := range source {
		buckets = append(buckets, util.Bucket{
			Key:   key,
			Count: agg.Count,
			Min:   agg.Min,
			Max:   agg.Max,
			Avg:   agg.Avg,
			Sum:   agg.Sum,
		})
	}
	return buckets
}
