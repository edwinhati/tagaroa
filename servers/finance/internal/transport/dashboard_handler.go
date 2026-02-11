package httphandler

import (
	"fmt"
	"net/http"
	"time"

	appbudget "github.com/edwinhati/tagaroa/servers/finance/internal/application/budget"
	"github.com/edwinhati/tagaroa/servers/finance/internal/application/dashboard"
	appinvestment "github.com/edwinhati/tagaroa/servers/finance/internal/application/investment"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/account"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/transaction"
	infrahttp "github.com/edwinhati/tagaroa/servers/finance/internal/infrastructure/http"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/util"
)

// DashboardHandler handles HTTP requests for dashboard data
type DashboardHandler struct {
	dashboardService  *dashboard.Service
	accountRepo       account.Repository
	transactionRepo   transaction.Repository
	budgetService     *appbudget.Service
	investmentService *appinvestment.Service
}

// NewDashboardHandler creates a new dashboard handler
func NewDashboardHandler(
	dashboardService *dashboard.Service,
	accountRepo account.Repository,
	transactionRepo transaction.Repository,
	budgetService *appbudget.Service,
	investmentService *appinvestment.Service,
) *DashboardHandler {
	return &DashboardHandler{
		dashboardService:  dashboardService,
		accountRepo:       accountRepo,
		transactionRepo:   transactionRepo,
		budgetService:     budgetService,
		investmentService: investmentService,
	}
}

// SetupRoutes sets up the dashboard routes
func (h *DashboardHandler) SetupRoutes(router *infrahttp.RouterGroup) {
	router.HandleFunc("GET /dashboard/summary", h.GetSummary)
	router.HandleFunc("GET /dashboard/monthly", h.GetMonthlySummary)
	router.HandleFunc("GET /dashboard/current-month", h.GetCurrentMonthSummary)
	router.HandleFunc("GET /dashboard/budget-performance", h.GetBudgetPerformance)
	router.HandleFunc("GET /dashboard/accounts", h.GetAccounts)
	router.HandleFunc("GET /dashboard/expense-breakdown", h.GetExpenseBreakdown)
	router.HandleFunc("GET /dashboard/transaction-trends", h.GetTransactionTrends)
}

// GetSummary retrieves dashboard summary for a user
func (h *DashboardHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	startDateStr := r.URL.Query().Get("start_date")
	endDateStr := r.URL.Query().Get("end_date")
	currencyStr := r.URL.Query().Get("currency")

	if currencyStr == "" {
		currencyStr = "USD"
	}

	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_DATE_FORMAT", "Invalid Date Format", "Use YYYY-MM-DD format")
		return
	}

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_DATE_FORMAT", "Invalid Date Format", "Use YYYY-MM-DD format")
		return
	}

	currency := shared.Currency(currencyStr)
	if !currency.IsValid() {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_CURRENCY", "Invalid Currency", "Currency must be one of: USD, IDR, EUR, GBP, JPY, SGD")
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	summary, err := h.dashboardService.GetSummary(r.Context(), userID, currency, dashboard.Period{
		StartDate: startDate,
		EndDate:   endDate,
	})
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Dashboard Summary", err.Error())
		return
	}

	// Calculate previous period for comparison
	prevDuration := endDate.Sub(startDate)
	prevStartDate := startDate.Add(-prevDuration)
	prevEndDate := startDate

	// Get previous period summary for comparison
	prevSummary, _ := h.dashboardService.GetSummary(r.Context(), userID, currency, dashboard.Period{
		StartDate: prevStartDate,
		EndDate:   prevEndDate,
	})

	// Convert to frontend format
	response := &SummaryResult{
		Income: &MoneyAmount{
			Amount:   summary.MonthlyIncome,
			Currency: string(summary.Currency),
		},
		Expenses: &MoneyAmount{
			Amount:   summary.MonthlyExpenses,
			Currency: string(summary.Currency),
		},
		Savings: &MoneyAmount{
			Amount:   summary.MonthlyIncome - summary.MonthlyExpenses,
			Currency: string(summary.Currency),
		},
		BudgetUtilization: 0.0,
		IncomeComparison: &PeriodComparison{
			Current:  summary.MonthlyIncome,
			Previous: prevSummary.MonthlyIncome,
			Change:   calculateChange(prevSummary.MonthlyIncome, summary.MonthlyIncome),
		},
		ExpenseComparison: &PeriodComparison{
			Current:  summary.MonthlyExpenses,
			Previous: prevSummary.MonthlyExpenses,
			Change:   calculateChange(prevSummary.MonthlyExpenses, summary.MonthlyExpenses),
		},
		SavingsComparison: &PeriodComparison{
			Current:  summary.MonthlyIncome - summary.MonthlyExpenses,
			Previous: prevSummary.MonthlyIncome - prevSummary.MonthlyExpenses,
			Change:   calculateChange(prevSummary.MonthlyIncome-prevSummary.MonthlyExpenses, summary.MonthlyIncome-summary.MonthlyExpenses),
		},
		PreviousPeriodStart: prevStartDate.Format(time.RFC3339),
		PreviousPeriodEnd:   prevEndDate.Format(time.RFC3339),
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, response, util.JsonApiMeta{
		Message: "Dashboard summary retrieved successfully",
	}, nil)
}

// calculateChange calculates percentage change between previous and current values
func calculateChange(previous, current float64) float64 {
	if previous == 0 {
		return 0
	}
	return ((current - previous) / previous) * 100
}

// GetMonthlySummary retrieves dashboard summary for a specific month
func (h *DashboardHandler) GetMonthlySummary(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	year := util.GetQueryInt(r, "year", 0)
	month := util.GetQueryInt(r, "month", 0)
	currencyStr := r.URL.Query().Get("currency")

	if currencyStr == "" {
		currencyStr = "USD"
	}

	if year == 0 || month == 0 {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_PARAMETERS", "Invalid Parameters", "year and month are required")
		return
	}

	if month < 1 || month > 12 {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_MONTH", "Invalid Month", "Month must be between 1 and 12")
		return
	}

	currency := shared.Currency(currencyStr)
	if !currency.IsValid() {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_CURRENCY", "Invalid Currency", "Currency must be one of: USD, IDR, EUR, GBP, JPY, SGD")
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	summary, err := h.dashboardService.GetMonthlySummary(r.Context(), userID, currency, year, month)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Monthly Summary", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, summary, util.JsonApiMeta{
		Message: "Monthly summary retrieved successfully",
	}, nil)
}

// GetCurrentMonthSummary retrieves dashboard summary for the current month
func (h *DashboardHandler) GetCurrentMonthSummary(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	currencyStr := r.URL.Query().Get("currency")
	if currencyStr == "" {
		currencyStr = "USD"
	}

	currency := shared.Currency(currencyStr)
	if !currency.IsValid() {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_CURRENCY", "Invalid Currency", "Currency must be one of: USD, IDR, EUR, GBP, JPY, SGD")
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	summary, err := h.dashboardService.GetCurrentMonthSummary(r.Context(), userID, currency)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Current Month Summary", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, summary, util.JsonApiMeta{
		Message: "Current month summary retrieved successfully",
	}, nil)
}

// GetAccounts retrieves account aggregations for the dashboard
func (h *DashboardHandler) GetAccounts(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	ctx := r.Context()
	userID := shared.UserIDFromUUID(userIDUUID)

	// Get all accounts
	accounts, err := h.accountRepo.FindByUserID(ctx, userID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Accounts", err.Error())
		return
	}

	// Aggregate by type
	byTypeMap := make(map[string]*AccountAggregation)
	byCurrencyMap := make(map[string]*AccountAggregation)

	for _, acc := range accounts {
		if acc.IsDeleted() {
			continue
		}

		accType := string(acc.Type())
		currency := string(acc.Currency())
		balance := acc.Balance()

		// Aggregate by type
		if _, exists := byTypeMap[accType]; !exists {
			byTypeMap[accType] = &AccountAggregation{
				Type:    accType,
				Count:   0,
				Balance: 0,
			}
		}
		byTypeMap[accType].Count++
		byTypeMap[accType].Balance += balance

		// Aggregate by currency
		if _, exists := byCurrencyMap[currency]; !exists {
			byCurrencyMap[currency] = &AccountAggregation{
				Type:    currency,
				Count:   0,
				Balance: 0,
			}
		}
		byCurrencyMap[currency].Count++
		byCurrencyMap[currency].Balance += balance
	}

	// Convert maps to slices
	byType := make([]*AccountAggregation, 0, len(byTypeMap))
	for _, agg := range byTypeMap {
		byType = append(byType, agg)
	}

	byCurrency := make([]*AccountAggregation, 0, len(byCurrencyMap))
	for _, agg := range byCurrencyMap {
		byCurrency = append(byCurrency, agg)
	}

	response := &AccountAggregationsResult{
		ByType:     byType,
		ByCurrency: byCurrency,
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, response, util.JsonApiMeta{
		Message: "Account aggregations retrieved successfully",
	}, nil)
}

// GetBudgetPerformance retrieves budget performance data
func (h *DashboardHandler) GetBudgetPerformance(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	month := util.GetQueryInt(r, "month", int(time.Now().Month()))
	year := util.GetQueryInt(r, "year", time.Now().Year())

	ctx := r.Context()
	userID := shared.UserIDFromUUID(userIDUUID)

	// Get the start and end dates for the month
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	// End date should be end of the last day of the month (23:59:59)
	endDate := time.Date(year, time.Month(month)+1, 1, 23, 59, 59, 999999999, time.UTC).AddDate(0, 0, -1)

	// Get budget for the month
	budget, err := h.budgetService.GetBudgetByMonthYear(ctx, userID, month, year)
	if err != nil {
		// Return empty result if no budget found
		response := &BudgetPerformanceResult{
			Month:             month,
			Year:              year,
			Items:             []*BudgetPerformanceItem{},
			TotalAllocated:    0,
			TotalSpent:        0,
			TotalRemaining:    0,
			OverallPercentage: 0,
		}
		util.WriteJsonApiResponse(w, r, http.StatusOK, response, util.JsonApiMeta{
			Message: "Budget performance retrieved successfully",
		}, nil)
		return
	}

	// Get all transactions for the period to calculate actual spending
	params := transaction.FindManyParams{
		UserID:    userID,
		StartDate: &startDate,
		EndDate:   &endDate,
	}

	txnResult, err := h.transactionRepo.FindMany(ctx, params)
	if err != nil {
		// If we can't get transactions, return budget with zero spent
		txnResult = &transaction.FindManyResult{Transactions: []*transaction.Transaction{}}
	}

	// Calculate spent amount per budget item from transactions
	spentByBudgetItem := make(map[string]float64)
	for _, txn := range txnResult.Transactions {
		if !txn.IsDeleted() && !txn.Type().IsIncome() {
			budgetItemID := txn.BudgetItemID()
			if budgetItemID != nil {
				spentByBudgetItem[budgetItemID.String()] += txn.Amount()
			}
		}
	}

	// Convert budget items to performance items with actual spent from transactions
	items := make([]*BudgetPerformanceItem, 0)
	totalAllocated := 0.0
	totalSpent := 0.0

	for _, item := range budget.Items() {
		allocated := item.Allocation()
		itemID := item.ID().String()
		spent := spentByBudgetItem[itemID] // Use actual spent from transactions
		remaining := allocated - spent
		percentage := 0.0
		if allocated > 0 {
			percentage = (spent / allocated) * 100
		}

		totalAllocated += allocated
		totalSpent += spent

		items = append(items, &BudgetPerformanceItem{
			Category:     string(item.Category()),
			Allocated:    allocated,
			Spent:        spent,
			Remaining:    remaining,
			Percentage:   percentage,
			IsOverBudget: spent > allocated,
		})
	}

	totalRemaining := totalAllocated - totalSpent
	overallPercentage := 0.0
	if totalAllocated > 0 {
		overallPercentage = (totalSpent / totalAllocated) * 100
	}

	response := &BudgetPerformanceResult{
		Month:             month,
		Year:              year,
		Items:             items,
		TotalAllocated:    totalAllocated,
		TotalSpent:        totalSpent,
		TotalRemaining:    totalRemaining,
		OverallPercentage: overallPercentage,
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, response, util.JsonApiMeta{
		Message: "Budget performance retrieved successfully",
	}, nil)
}

// GetExpenseBreakdown retrieves expense breakdown by category
func (h *DashboardHandler) GetExpenseBreakdown(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	startDateStr := r.URL.Query().Get("start_date")
	endDateStr := r.URL.Query().Get("end_date")

	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_DATE_FORMAT", "Invalid Date Format", "Use YYYY-MM-DD format")
		return
	}

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_DATE_FORMAT", "Invalid Date Format", "Use YYYY-MM-DD format")
		return
	}

	ctx := r.Context()
	userID := shared.UserIDFromUUID(userIDUUID)

	// Get budget for the period to map budget item IDs to category names
	month := int(startDate.Month())
	year := startDate.Year()
	budgetItemIDToCategory := make(map[string]string)

	budget, err := h.budgetService.GetBudgetByMonthYear(ctx, userID, month, year)
	if err == nil && budget != nil {
		for _, item := range budget.Items() {
			budgetItemIDToCategory[item.ID().String()] = string(item.Category())
		}
	}

	// Get expense transactions for the period
	params := transaction.FindManyParams{
		UserID:    userID,
		StartDate: &startDate,
		EndDate:   &endDate,
	}

	result, err := h.transactionRepo.FindMany(ctx, params)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Transactions", err.Error())
		return
	}

	// Aggregate expenses by budget item category
	categoryMap := make(map[string]*ExpenseBreakdownItem)
	totalExpenses := 0.0

	for _, txn := range result.Transactions {
		if !txn.IsDeleted() && !txn.Type().IsIncome() {
			budgetItemID := txn.BudgetItemID()
			if budgetItemID == nil {
				continue
			}

			// Look up category name from budget item mapping
			budgetItemIDStr := budgetItemID.String()
			category := budgetItemIDToCategory[budgetItemIDStr]
			if category == "" {
				// Fallback to budget item ID if not found in budget
				category = "Uncategorized"
			}
			amount := txn.Amount()

			if _, exists := categoryMap[category]; !exists {
				categoryMap[category] = &ExpenseBreakdownItem{
					Category:   category,
					Amount:     0,
					Percentage: 0,
				}
			}
			categoryMap[category].Amount += amount
			totalExpenses += amount
		}
	}

	// Calculate percentages
	items := make([]*ExpenseBreakdownItem, 0, len(categoryMap))
	for _, item := range categoryMap {
		if totalExpenses > 0 {
			item.Percentage = (item.Amount / totalExpenses) * 100
		}
		items = append(items, item)
	}

	response := &ExpenseBreakdownResult{
		TotalExpenses: totalExpenses,
		Items:         items,
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, response, util.JsonApiMeta{
		Message: "Expense breakdown retrieved successfully",
	}, nil)
}

// GetTransactionTrends retrieves transaction trends over time
func (h *DashboardHandler) GetTransactionTrends(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	startDateStr := r.URL.Query().Get("start_date")
	endDateStr := r.URL.Query().Get("end_date")
	granularity := r.URL.Query().Get("granularity")

	if granularity == "" {
		granularity = "month"
	}

	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_DATE_FORMAT", "Invalid Date Format", "Use YYYY-MM-DD format")
		return
	}

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_DATE_FORMAT", "Invalid Date Format", "Use YYYY-MM-DD format")
		return
	}

	ctx := r.Context()
	userID := shared.UserIDFromUUID(userIDUUID)

	// Get transactions for the period
	params := transaction.FindManyParams{
		UserID:    userID,
		StartDate: &startDate,
		EndDate:   &endDate,
	}

	result, err := h.transactionRepo.FindMany(ctx, params)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Transactions", err.Error())
		return
	}

	// Group transactions by period based on granularity
	periodMap := make(map[string]*TransactionTrendItem)

	for _, txn := range result.Transactions {
		if txn.IsDeleted() {
			continue
		}

		date := txn.Date()
		var period string

		switch granularity {
		case "day":
			period = date.Format("2006-01-02")
		case "week":
			// Get start of week
			year, week := date.ISOWeek()
			period = fmt.Sprintf("%d-W%02d", year, week)
		case "month":
			period = date.Format("2006-01")
		case "year":
			period = date.Format("2006")
		default:
			period = date.Format("2006-01")
		}

		if _, exists := periodMap[period]; !exists {
			periodMap[period] = &TransactionTrendItem{
				Period:   period,
				Income:   0,
				Expenses: 0,
				NetFlow:  0,
			}
		}

		amount := txn.Amount()
		if txn.Type().IsIncome() {
			periodMap[period].Income += amount
			periodMap[period].NetFlow += amount
		} else {
			periodMap[period].Expenses += amount
			periodMap[period].NetFlow -= amount
		}
	}

	// Convert to slice
	trends := make([]*TransactionTrendItem, 0, len(periodMap))
	for _, item := range periodMap {
		trends = append(trends, item)
	}

	response := &TransactionTrendsResult{
		Granularity: granularity,
		Trends:      trends,
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, response, util.JsonApiMeta{
		Message: "Transaction trends retrieved successfully",
	}, nil)
}

// Response types

type AccountAggregation struct {
	Type    string  `json:"type"`
	Count   int     `json:"count"`
	Balance float64 `json:"balance"`
}

type AccountAggregationsResult struct {
	ByType     []*AccountAggregation `json:"by_type"`
	ByCurrency []*AccountAggregation `json:"by_currency"`
}

type BudgetPerformanceItem struct {
	Category     string  `json:"category"`
	Allocated    float64 `json:"allocated"`
	Spent        float64 `json:"spent"`
	Remaining    float64 `json:"remaining"`
	Percentage   float64 `json:"percentage"`
	IsOverBudget bool    `json:"is_over_budget"`
}

type BudgetPerformanceResult struct {
	Month             int                      `json:"month"`
	Year              int                      `json:"year"`
	Items             []*BudgetPerformanceItem `json:"items"`
	TotalAllocated    float64                  `json:"total_allocated"`
	TotalSpent        float64                  `json:"total_spent"`
	TotalRemaining    float64                  `json:"total_remaining"`
	OverallPercentage float64                  `json:"overall_percentage"`
}

type TransactionTrendItem struct {
	Period   string  `json:"period"`
	Income   float64 `json:"income"`
	Expenses float64 `json:"expenses"`
	NetFlow  float64 `json:"net_flow"`
}

type TransactionTrendsResult struct {
	Granularity string                  `json:"granularity"`
	Trends      []*TransactionTrendItem `json:"trends"`
}

type ExpenseBreakdownItem struct {
	Category   string  `json:"category"`
	Amount     float64 `json:"amount"`
	Percentage float64 `json:"percentage"`
}

type ExpenseBreakdownResult struct {
	TotalExpenses float64                 `json:"total_expenses"`
	Items         []*ExpenseBreakdownItem `json:"items"`
}

// SummaryResult represents the dashboard summary response for frontend
type MoneyAmount struct {
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
}

type PeriodComparison struct {
	Current  float64 `json:"current"`
	Previous float64 `json:"previous"`
	Change   float64 `json:"change"`
}

type SummaryResult struct {
	Income              *MoneyAmount      `json:"income"`
	Expenses            *MoneyAmount      `json:"expenses"`
	Savings             *MoneyAmount      `json:"savings"`
	BudgetUtilization   float64           `json:"budget_utilization"`
	IncomeComparison    *PeriodComparison `json:"income_comparison"`
	ExpenseComparison   *PeriodComparison `json:"expense_comparison"`
	SavingsComparison   *PeriodComparison `json:"savings_comparison"`
	PreviousPeriodStart string            `json:"previous_period_start"`
	PreviousPeriodEnd   string            `json:"previous_period_end"`
}
