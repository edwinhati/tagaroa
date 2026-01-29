package service

import (
	"context"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/repository"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type SummaryParams struct {
	UserID    uuid.UUID
	StartDate *time.Time
	EndDate   *time.Time
}

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
	Income              MoneyAmount      `json:"income"`
	Expenses            MoneyAmount      `json:"expenses"`
	Savings             MoneyAmount      `json:"savings"`
	BudgetUtilization   float64          `json:"budget_utilization"`
	IncomeComparison    PeriodComparison `json:"income_comparison"`
	ExpenseComparison   PeriodComparison `json:"expense_comparison"`
	SavingsComparison   PeriodComparison `json:"savings_comparison"`
	PreviousPeriodStart time.Time        `json:"previous_period_start"`
	PreviousPeriodEnd   time.Time        `json:"previous_period_end"`
}

type AccountAggregation struct {
	Type    string  `json:"type"`
	Count   int     `json:"count"`
	Balance float64 `json:"balance"`
}

type AccountAggregationsResult struct {
	ByType     []AccountAggregation `json:"by_type"`
	ByCurrency []AccountAggregation `json:"by_currency"`
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
	Month             int                     `json:"month"`
	Year              int                     `json:"year"`
	Items             []BudgetPerformanceItem `json:"items"`
	TotalAllocated    float64                 `json:"total_allocated"`
	TotalSpent        float64                 `json:"total_spent"`
	TotalRemaining    float64                 `json:"total_remaining"`
	OverallPercentage float64                 `json:"overall_percentage"`
}

type TransactionTrendItem struct {
	Period   string  `json:"period"`
	Income   float64 `json:"income"`
	Expenses float64 `json:"expenses"`
	NetFlow  float64 `json:"net_flow"`
}

type TransactionTrendsResult struct {
	Granularity string                 `json:"granularity"`
	Trends      []TransactionTrendItem `json:"trends"`
}

type ExpenseBreakdownItem struct {
	Category   string  `json:"category"`
	Amount     float64 `json:"amount"`
	Percentage float64 `json:"percentage"`
}

type ExpenseBreakdownResult struct {
	TotalExpenses float64                `json:"total_expenses"`
	Items         []ExpenseBreakdownItem `json:"items"`
}

type DashboardService interface {
	GetSummary(ctx context.Context, params SummaryParams) (*SummaryResult, error)
	GetAccountAggregations(ctx context.Context, userID uuid.UUID) (*AccountAggregationsResult, error)
	GetBudgetPerformance(ctx context.Context, userID uuid.UUID, month, year int) (*BudgetPerformanceResult, error)
	GetTransactionTrends(ctx context.Context, userID uuid.UUID, startDate, endDate time.Time, granularity string) (*TransactionTrendsResult, error)
	GetExpenseBreakdown(ctx context.Context, userID uuid.UUID, startDate, endDate time.Time) (*ExpenseBreakdownResult, error)
}

type dashboardService struct {
	transactionRepo repository.TransactionRepository
	budgetRepo      repository.BudgetRepository
	accountRepo     repository.AccountRepository
	logger          *zap.SugaredLogger
}

func NewDashboardService(
	transactionRepo repository.TransactionRepository,
	budgetRepo repository.BudgetRepository,
	accountRepo repository.AccountRepository,
) DashboardService {
	return &dashboardService{
		transactionRepo: transactionRepo,
		budgetRepo:      budgetRepo,
		accountRepo:     accountRepo,
		logger:          logger.New().With("service", "dashboard"),
	}
}

func (s *dashboardService) GetSummary(ctx context.Context, params SummaryParams) (*SummaryResult, error) {
	s.logger.Infow("getting dashboard summary", "user_id", params.UserID.String())

	startDate := params.StartDate
	endDate := params.EndDate

	if startDate == nil {
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		startDate = &startOfMonth
	}
	if endDate == nil {
		now := time.Now()
		endOfMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Second)
		endDate = &endOfMonth
	}

	where := map[string]any{
		"user_id":    params.UserID,
		"start_date": *startDate,
		"end_date":   *endDate,
	}

	typeAggs, err := s.transactionRepo.GetTypeAggregations(ctx, where)
	if err != nil {
		s.logger.Errorw("failed to get type aggregations", "error", err)
		return nil, err
	}

	income := typeAggs["INCOME"]
	expense := typeAggs["EXPENSE"]

	savings := income.Sum - expense.Sum

	daysDiff := int(endDate.Sub(*startDate).Hours() / 24)
	prevStart := startDate.AddDate(0, 0, -daysDiff-1)
	prevEnd := startDate.Add(-time.Second)

	prevWhere := map[string]any{
		"user_id":    params.UserID,
		"start_date": prevStart,
		"end_date":   prevEnd,
	}
	prevTypeAggs, err := s.transactionRepo.GetTypeAggregations(ctx, prevWhere)
	if err != nil {
		s.logger.Errorw("failed to get previous period aggregations", "error", err)
		return nil, err
	}

	prevIncome := prevTypeAggs["INCOME"]
	prevExpense := prevTypeAggs["EXPENSE"]

	var budgetUtilization float64
	budget, err := s.budgetRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{
			"user_id": params.UserID,
			"month":   endDate.Month(),
			"year":    endDate.Year(),
		},
	})
	if err != nil {
		s.logger.Errorw("failed to get budget", "error", err)
		return nil, err
	}
	if budget != nil && budget.Amount > 0 {
		budgetUtilization = (expense.Sum / budget.Amount) * 100
	}

	result := &SummaryResult{
		Income: MoneyAmount{
			Amount:   income.Sum,
			Currency: "USD",
		},
		Expenses: MoneyAmount{
			Amount:   expense.Sum,
			Currency: "USD",
		},
		Savings: MoneyAmount{
			Amount:   savings,
			Currency: "USD",
		},
		BudgetUtilization: budgetUtilization,
		IncomeComparison: PeriodComparison{
			Current:  income.Sum,
			Previous: prevIncome.Sum,
			Change:   income.Sum - prevIncome.Sum,
		},
		ExpenseComparison: PeriodComparison{
			Current:  expense.Sum,
			Previous: prevExpense.Sum,
			Change:   expense.Sum - prevExpense.Sum,
		},
		SavingsComparison: PeriodComparison{
			Current:  savings,
			Previous: prevIncome.Sum - prevExpense.Sum,
			Change:   savings - (prevIncome.Sum - prevExpense.Sum),
		},
		PreviousPeriodStart: prevStart,
		PreviousPeriodEnd:   prevEnd,
	}

	s.logger.Infow("dashboard summary retrieved", "user_id", params.UserID.String(), "income", income.Sum, "expenses", expense.Sum, "savings", savings)
	return result, nil
}

func (s *dashboardService) GetAccountAggregations(ctx context.Context, userID uuid.UUID) (*AccountAggregationsResult, error) {
	s.logger.Infow("getting account aggregations", "user_id", userID.String())

	where := map[string]any{
		"user_id": userID,
	}

	typeAggs, err := s.accountRepo.GetTypeAggregations(ctx, where)
	if err != nil {
		s.logger.Errorw("failed to get account type aggregations", "error", err)
		return nil, err
	}

	currencyAggs, err := s.accountRepo.GetCurrencyAggregations(ctx, where)
	if err != nil {
		s.logger.Errorw("failed to get account currency aggregations", "error", err)
		return nil, err
	}

	byType := make([]AccountAggregation, 0, len(typeAggs))
	for key, agg := range typeAggs {
		byType = append(byType, AccountAggregation{
			Type:    key,
			Count:   agg.Count,
			Balance: agg.Sum,
		})
	}

	byCurrency := make([]AccountAggregation, 0, len(currencyAggs))
	for key, agg := range currencyAggs {
		byCurrency = append(byCurrency, AccountAggregation{
			Type:    key,
			Count:   agg.Count,
			Balance: agg.Sum,
		})
	}

	s.logger.Infow("account aggregations retrieved", "user_id", userID.String(), "types_count", len(byType), "currencies_count", len(byCurrency))
	return &AccountAggregationsResult{
		ByType:     byType,
		ByCurrency: byCurrency,
	}, nil
}

func (s *dashboardService) GetBudgetPerformance(ctx context.Context, userID uuid.UUID, month, year int) (*BudgetPerformanceResult, error) {
	s.logger.Infow("getting budget performance", "user_id", userID.String(), "month", month, "year", year)

	budget, err := s.budgetRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{
			"user_id": userID,
			"month":   month,
			"year":    year,
		},
	})
	if err != nil {
		s.logger.Errorw("failed to get budget", "error", err)
		return nil, err
	}
	if budget == nil {
		s.logger.Infow("no budget found for period", "user_id", userID.String(), "month", month, "year", year)
		return &BudgetPerformanceResult{
			Month: month,
			Year:  year,
		}, nil
	}

	budgetItemIDs := make([]uuid.UUID, len(budget.BudgetItems))
	for i, item := range budget.BudgetItems {
		budgetItemIDs[i] = item.ID
	}

	spentMap, err := s.budgetRepo.GetBudgetItemsSpent(ctx, budgetItemIDs)
	if err != nil {
		s.logger.Errorw("failed to get budget items spent", "error", err)
		return nil, err
	}

	items := make([]BudgetPerformanceItem, len(budget.BudgetItems))
	var totalAllocated, totalSpent float64

	for i, item := range budget.BudgetItems {
		spent := spentMap[item.ID]
		remaining := item.Allocation - spent
		var percentage float64
		if item.Allocation > 0 {
			percentage = (spent / item.Allocation) * 100
		}

		items[i] = BudgetPerformanceItem{
			Category:     item.Category,
			Allocated:    item.Allocation,
			Spent:        spent,
			Remaining:    remaining,
			Percentage:   percentage,
			IsOverBudget: spent > item.Allocation,
		}

		totalAllocated += item.Allocation
		totalSpent += spent
	}

	var overallPercentage float64
	if totalAllocated > 0 {
		overallPercentage = (totalSpent / totalAllocated) * 100
	}

	s.logger.Infow("budget performance retrieved", "user_id", userID.String(), "month", month, "year", year, "total_allocated", totalAllocated, "total_spent", totalSpent)
	return &BudgetPerformanceResult{
		Month:             month,
		Year:              year,
		Items:             items,
		TotalAllocated:    totalAllocated,
		TotalSpent:        totalSpent,
		TotalRemaining:    totalAllocated - totalSpent,
		OverallPercentage: overallPercentage,
	}, nil
}

func (s *dashboardService) GetTransactionTrends(ctx context.Context, userID uuid.UUID, startDate, endDate time.Time, granularity string) (*TransactionTrendsResult, error) {
	s.logger.Infow("getting transaction trends", "user_id", userID.String(), "granularity", granularity)

	where := map[string]any{
		"user_id":    userID,
		"start_date": startDate,
		"end_date":   endDate,
	}

	typeAggs, err := s.transactionRepo.GetTypeAggregations(ctx, where)
	if err != nil {
		s.logger.Errorw("failed to get transaction aggregations", "error", err)
		return nil, err
	}

	trends := make([]TransactionTrendItem, 0)

	switch granularity {
	case "day":
		current := startDate
		for !current.After(endDate) {
			dayEnd := current.AddDate(0, 0, 1).Add(-time.Second)
			if dayEnd.After(endDate) {
				dayEnd = endDate
			}

			dayWhere := map[string]any{
				"user_id":    userID,
				"start_date": current,
				"end_date":   dayEnd,
			}
			dayAggs, err := s.transactionRepo.GetTypeAggregations(ctx, dayWhere)
			if err != nil {
				s.logger.Errorw("failed to get day aggregations", "error", err, "date", current)
				return nil, err
			}

			income := dayAggs["INCOME"]
			expense := dayAggs["EXPENSE"]

			trends = append(trends, TransactionTrendItem{
				Period:   current.Format("2006-01-02"),
				Income:   income.Sum,
				Expenses: expense.Sum,
				NetFlow:  income.Sum - expense.Sum,
			})

			current = current.AddDate(0, 0, 1)
		}
	case "week":
		current := startDate
		for !current.After(endDate) {
			weekEnd := current.AddDate(0, 0, 7)
			if weekEnd.After(endDate) {
				weekEnd = endDate.Add(1)
			}
			weekEnd = weekEnd.Add(-time.Second)

			weekWhere := map[string]any{
				"user_id":    userID,
				"start_date": current,
				"end_date":   weekEnd,
			}
			weekAggs, err := s.transactionRepo.GetTypeAggregations(ctx, weekWhere)
			if err != nil {
				s.logger.Errorw("failed to get week aggregations", "error", err, "start_date", current)
				return nil, err
			}

			income := weekAggs["INCOME"]
			expense := weekAggs["EXPENSE"]

			trends = append(trends, TransactionTrendItem{
				Period:   current.Format("2006-01-02"),
				Income:   income.Sum,
				Expenses: expense.Sum,
				NetFlow:  income.Sum - expense.Sum,
			})

			current = current.AddDate(0, 0, 7)
		}
	case "month":
		current := time.Date(startDate.Year(), startDate.Month(), 1, 0, 0, 0, 0, startDate.Location())
		for !current.After(endDate) {
			monthEnd := time.Date(current.Year(), current.Month()+1, 1, 0, 0, 0, 0, current.Location()).Add(-time.Second)
			if monthEnd.After(endDate) {
				monthEnd = endDate
			}

			monthWhere := map[string]any{
				"user_id":    userID,
				"start_date": current,
				"end_date":   monthEnd,
			}
			monthAggs, err := s.transactionRepo.GetTypeAggregations(ctx, monthWhere)
			if err != nil {
				s.logger.Errorw("failed to get month aggregations", "error", err, "month", current.Format("2006-01"))
				return nil, err
			}

			income := monthAggs["INCOME"]
			expense := monthAggs["EXPENSE"]

			trends = append(trends, TransactionTrendItem{
				Period:   current.Format("2006-01"),
				Income:   income.Sum,
				Expenses: expense.Sum,
				NetFlow:  income.Sum - expense.Sum,
			})

			current = current.AddDate(0, 1, 0)
		}
	default:
		income := typeAggs["INCOME"]
		expense := typeAggs["EXPENSE"]
		trends = append(trends, TransactionTrendItem{
			Period:   "total",
			Income:   income.Sum,
			Expenses: expense.Sum,
			NetFlow:  income.Sum - expense.Sum,
		})
	}

	s.logger.Infow("transaction trends retrieved", "user_id", userID.String(), "granularity", granularity, "periods_count", len(trends))
	return &TransactionTrendsResult{
		Granularity: granularity,
		Trends:      trends,
	}, nil
}

func (s *dashboardService) GetExpenseBreakdown(ctx context.Context, userID uuid.UUID, startDate, endDate time.Time) (*ExpenseBreakdownResult, error) {
	s.logger.Infow("getting expense breakdown", "user_id", userID.String())

	where := map[string]any{
		"user_id":    userID,
		"type":       []string{"EXPENSE"},
		"start_date": startDate,
		"end_date":   endDate,
	}

	categoryAggs, err := s.transactionRepo.GetCategoryAggregations(ctx, where)
	if err != nil {
		s.logger.Errorw("failed to get category aggregations", "error", err)
		return nil, err
	}

	var totalExpenses float64
	for _, agg := range categoryAggs {
		totalExpenses += agg.Sum
	}

	items := make([]ExpenseBreakdownItem, 0, len(categoryAggs))
	for category, agg := range categoryAggs {
		var percentage float64
		if totalExpenses > 0 {
			percentage = (agg.Sum / totalExpenses) * 100
		}

		items = append(items, ExpenseBreakdownItem{
			Category:   category,
			Amount:     agg.Sum,
			Percentage: percentage,
		})
	}

	s.logger.Infow("expense breakdown retrieved", "user_id", userID.String(), "total_expenses", totalExpenses, "categories_count", len(items))
	return &ExpenseBreakdownResult{
		TotalExpenses: totalExpenses,
		Items:         items,
	}, nil
}
