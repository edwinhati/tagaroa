package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestNetCashFlowProperty(t *testing.T) {
	t.Run("net cash flow equals income minus expenses", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endOfMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Second)

		currentAggs := map[string]util.AggregationResult{
			"INCOME": {
				Count: 5,
				Sum:   5000.00,
				Min:   100.00,
				Max:   2000.00,
				Avg:   1000.00,
			},
			"EXPENSE": {
				Count: 20,
				Sum:   3000.00,
				Min:   10.00,
				Max:   500.00,
				Avg:   150.00,
			},
		}
		prevAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 4000.00},
			"EXPENSE": {Sum: 2500.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(currentAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(prevAggs, nil).Once()
		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return((*model.Budget)(nil), nil)

		params := SummaryParams{
			UserID:    userID,
			StartDate: &startOfMonth,
			EndDate:   &endOfMonth,
		}

		result, err := service.GetSummary(context.Background(), params)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		expectedNetCashFlow := currentAggs["INCOME"].Sum - currentAggs["EXPENSE"].Sum
		assert.Equal(t, expectedNetCashFlow, result.Savings.Amount, "net cash flow should equal income minus expenses")
		assert.Equal(t, 2000.00, result.Savings.Amount)
	})

	t.Run("negative net cash flow when expenses exceed income", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endOfMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Second)

		currentAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 1000.00},
			"EXPENSE": {Sum: 3000.00},
		}
		prevAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 500.00},
			"EXPENSE": {Sum: 1500.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(currentAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(prevAggs, nil).Once()
		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return((*model.Budget)(nil), nil)

		params := SummaryParams{
			UserID:    userID,
			StartDate: &startOfMonth,
			EndDate:   &endOfMonth,
		}

		result, err := service.GetSummary(context.Background(), params)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		expectedNetCashFlow := currentAggs["INCOME"].Sum - currentAggs["EXPENSE"].Sum
		assert.Equal(t, expectedNetCashFlow, result.Savings.Amount, "net cash flow should be negative when expenses exceed income")
		assert.True(t, result.Savings.Amount < 0, "savings should be negative")
	})

	t.Run("zero net cash flow when income equals expenses", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endOfMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Second)

		currentAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 2500.00},
			"EXPENSE": {Sum: 2500.00},
		}
		prevAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 2000.00},
			"EXPENSE": {Sum: 2000.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(currentAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(prevAggs, nil).Once()
		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return((*model.Budget)(nil), nil)

		params := SummaryParams{
			UserID:    userID,
			StartDate: &startOfMonth,
			EndDate:   &endOfMonth,
		}

		result, err := service.GetSummary(context.Background(), params)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Equal(t, 0.0, result.Savings.Amount, "savings should be zero when income equals expenses")
	})

	t.Run("previous period comparison calculated correctly", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endOfMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Second)

		currentAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 4000.00},
			"EXPENSE": {Sum: 2000.00},
		}
		prevAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 3000.00},
			"EXPENSE": {Sum: 1500.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(currentAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(prevAggs, nil).Once()
		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return((*model.Budget)(nil), nil)

		params := SummaryParams{
			UserID:    userID,
			StartDate: &startOfMonth,
			EndDate:   &endOfMonth,
		}

		result, err := service.GetSummary(context.Background(), params)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Equal(t, currentAggs["INCOME"].Sum, result.IncomeComparison.Current)
		assert.Equal(t, prevAggs["INCOME"].Sum, result.IncomeComparison.Previous)
		assert.Equal(t, currentAggs["INCOME"].Sum-prevAggs["INCOME"].Sum, result.IncomeComparison.Change)

		assert.Equal(t, currentAggs["EXPENSE"].Sum, result.ExpenseComparison.Current)
		assert.Equal(t, prevAggs["EXPENSE"].Sum, result.ExpenseComparison.Previous)
		assert.Equal(t, currentAggs["EXPENSE"].Sum-prevAggs["EXPENSE"].Sum, result.ExpenseComparison.Change)
	})
}

func TestGetSummaryWithBudget(t *testing.T) {
	t.Run("budget utilization calculated correctly when budget exists", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endOfMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Second)

		currentAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 5000.00},
			"EXPENSE": {Sum: 2500.00},
		}
		prevAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 4000.00},
			"EXPENSE": {Sum: 2000.00},
		}

		budget := &model.Budget{
			ID:       uuid.New(),
			Month:    int(startOfMonth.Month()),
			Year:     startOfMonth.Year(),
			Amount:   5000.00,
			UserID:   userID,
			Currency: "USD",
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(currentAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(prevAggs, nil).Once()
		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()

		params := SummaryParams{
			UserID:    userID,
			StartDate: &startOfMonth,
			EndDate:   &endOfMonth,
		}

		result, err := service.GetSummary(context.Background(), params)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, 50.0, result.BudgetUtilization, "budget utilization should be 50% when expenses are half of budget")
	})

	t.Run("budget utilization is zero when budget amount is zero", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endOfMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Second)

		currentAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 5000.00},
			"EXPENSE": {Sum: 2500.00},
		}
		prevAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 4000.00},
			"EXPENSE": {Sum: 2000.00},
		}

		budget := &model.Budget{
			ID:       uuid.New(),
			Month:    int(startOfMonth.Month()),
			Year:     startOfMonth.Year(),
			Amount:   0,
			UserID:   userID,
			Currency: "USD",
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(currentAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(prevAggs, nil).Once()
		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()

		params := SummaryParams{
			UserID:    userID,
			StartDate: &startOfMonth,
			EndDate:   &endOfMonth,
		}

		result, err := service.GetSummary(context.Background(), params)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, 0.0, result.BudgetUtilization, "budget utilization should be 0 when budget amount is zero")
	})

	t.Run("uses default dates when start and end dates are nil", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()

		currentAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 5000.00},
			"EXPENSE": {Sum: 2500.00},
		}
		prevAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 4000.00},
			"EXPENSE": {Sum: 2000.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(currentAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(prevAggs, nil).Once()
		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return((*model.Budget)(nil), nil).Once()

		params := SummaryParams{
			UserID: userID,
		}

		result, err := service.GetSummary(context.Background(), params)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, 5000.00, result.Income.Amount)
		assert.Equal(t, 2500.00, result.Expenses.Amount)
	})

	t.Run("returns error when GetTypeAggregations fails", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endOfMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Second)

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("db error"))

		params := SummaryParams{
			UserID:    userID,
			StartDate: &startOfMonth,
			EndDate:   &endOfMonth,
		}

		result, err := service.GetSummary(context.Background(), params)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "db error")
	})

	t.Run("returns error when previous period GetTypeAggregations fails", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endOfMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Second)

		currentAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 5000.00},
			"EXPENSE": {Sum: 2500.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(currentAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("previous period db error")).Once()

		params := SummaryParams{
			UserID:    userID,
			StartDate: &startOfMonth,
			EndDate:   &endOfMonth,
		}

		result, err := service.GetSummary(context.Background(), params)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "previous period db error")
	})

	t.Run("returns error when budget FindUnique fails", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endOfMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Second)

		currentAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 5000.00},
			"EXPENSE": {Sum: 2500.00},
		}
		prevAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 4000.00},
			"EXPENSE": {Sum: 2000.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(currentAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(prevAggs, nil).Once()
		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("budget db error"))

		params := SummaryParams{
			UserID:    userID,
			StartDate: &startOfMonth,
			EndDate:   &endOfMonth,
		}

		result, err := service.GetSummary(context.Background(), params)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "budget db error")
	})
}

func TestAccountBalanceAggregationProperty(t *testing.T) {
	t.Run("total balance equals sum of individual account balances", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()

		typeAggs := map[string]util.AggregationResult{
			"CHECKING": {Count: 2, Sum: 5000.00},
			"SAVINGS":  {Count: 1, Sum: 10000.00},
			"CREDIT":   {Count: 1, Sum: -500.00},
		}
		currencyAggs := map[string]util.AggregationResult{
			"USD": {Count: 4, Sum: 14500.00},
		}

		mockAccRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(typeAggs, nil).Once()
		mockAccRepo.On("GetCurrencyAggregations", mock.Anything, mock.Anything).Return(currencyAggs, nil).Once()

		result, err := service.GetAccountAggregations(context.Background(), userID)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		var totalBalance float64
		for _, agg := range result.ByType {
			totalBalance += agg.Balance
		}

		expectedTotal := typeAggs["CHECKING"].Sum + typeAggs["SAVINGS"].Sum + typeAggs["CREDIT"].Sum
		assert.Equal(t, expectedTotal, totalBalance, "total balance should equal sum of individual account balances")
		assert.Equal(t, 14500.00, totalBalance)
	})

	t.Run("account counts are correct", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()

		typeAggs := map[string]util.AggregationResult{
			"CHECKING": {Count: 3, Sum: 3000.00},
			"SAVINGS":  {Count: 2, Sum: 7000.00},
		}
		currencyAggs := map[string]util.AggregationResult{
			"USD": {Count: 5, Sum: 10000.00},
		}

		mockAccRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(typeAggs, nil).Once()
		mockAccRepo.On("GetCurrencyAggregations", mock.Anything, mock.Anything).Return(currencyAggs, nil).Once()

		result, err := service.GetAccountAggregations(context.Background(), userID)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		var totalCount int
		for _, agg := range result.ByType {
			totalCount += agg.Count
		}

		expectedTotal := typeAggs["CHECKING"].Count + typeAggs["SAVINGS"].Count
		assert.Equal(t, expectedTotal, totalCount, "total count should equal sum of individual account counts")
		assert.Equal(t, 5, totalCount)
	})

	t.Run("currency aggregations are separate from type aggregations", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()

		typeAggs := map[string]util.AggregationResult{
			"CHECKING": {Sum: 1000.00},
			"SAVINGS":  {Sum: 2000.00},
		}
		currencyAggs := map[string]util.AggregationResult{
			"USD": {Sum: 1500.00},
			"EUR": {Sum: 1500.00},
		}

		mockAccRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(typeAggs, nil).Once()
		mockAccRepo.On("GetCurrencyAggregations", mock.Anything, mock.Anything).Return(currencyAggs, nil).Once()

		result, err := service.GetAccountAggregations(context.Background(), userID)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Len(t, result.ByType, 2)
		assert.Len(t, result.ByCurrency, 2)

		var hasChecking, hasSavings bool
		var hasUSD, hasEUR bool
		for _, agg := range result.ByType {
			if agg.Type == "CHECKING" {
				hasChecking = true
				assert.Equal(t, 1000.00, agg.Balance)
			} else if agg.Type == "SAVINGS" {
				hasSavings = true
				assert.Equal(t, 2000.00, agg.Balance)
			}
		}
		assert.True(t, hasChecking, "Should have CHECKING type")
		assert.True(t, hasSavings, "Should have SAVINGS type")

		for _, agg := range result.ByCurrency {
			if agg.Type == "USD" {
				hasUSD = true
				assert.Equal(t, 1500.00, agg.Balance)
			} else if agg.Type == "EUR" {
				hasEUR = true
				assert.Equal(t, 1500.00, agg.Balance)
			}
		}
		assert.True(t, hasUSD, "Should have USD currency")
		assert.True(t, hasEUR, "Should have EUR currency")
	})

	t.Run("returns error when GetTypeAggregations fails", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()

		mockAccRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("type aggregation error")).Once()

		result, err := service.GetAccountAggregations(context.Background(), userID)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "type aggregation error")
	})

	t.Run("returns error when GetCurrencyAggregations fails", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()

		typeAggs := map[string]util.AggregationResult{
			"CHECKING": {Count: 1, Sum: 1000.00},
		}

		mockAccRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(typeAggs, nil).Once()
		mockAccRepo.On("GetCurrencyAggregations", mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("currency aggregation error")).Once()

		result, err := service.GetAccountAggregations(context.Background(), userID)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "currency aggregation error")
	})
}

func TestCurrencyGroupingIsolation(t *testing.T) {
	t.Run("different currencies are kept separate in aggregations", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()

		typeAggs := map[string]util.AggregationResult{
			"CHECKING": {Count: 2, Sum: 2000.00},
		}
		currencyAggs := map[string]util.AggregationResult{
			"USD": {Count: 1, Sum: 1000.00},
			"EUR": {Count: 1, Sum: 1000.00},
		}

		mockAccRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(typeAggs, nil).Once()
		mockAccRepo.On("GetCurrencyAggregations", mock.Anything, mock.Anything).Return(currencyAggs, nil).Once()

		result, err := service.GetAccountAggregations(context.Background(), userID)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		var usdTotal, eurTotal float64
		for _, agg := range result.ByCurrency {
			if agg.Type == "USD" {
				usdTotal = agg.Balance
			} else if agg.Type == "EUR" {
				eurTotal = agg.Balance
			}
		}

		assert.Equal(t, 1000.00, usdTotal, "USD balance should be isolated")
		assert.Equal(t, 1000.00, eurTotal, "EUR balance should be isolated")
		assert.Equal(t, len(result.ByCurrency), 2, "Should have 2 different currencies tracked separately")
	})

	t.Run("currency counts are independent of type counts", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()

		typeAggs := map[string]util.AggregationResult{
			"CHECKING": {Count: 5, Sum: 5000.00},
			"SAVINGS":  {Count: 3, Sum: 3000.00},
			"CREDIT":   {Count: 2, Sum: -1000.00},
		}
		currencyAggs := map[string]util.AggregationResult{
			"USD": {Count: 6, Sum: 6000.00},
			"EUR": {Count: 3, Sum: 1500.00},
			"GBP": {Count: 1, Sum: 500.00},
		}

		mockAccRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(typeAggs, nil).Once()
		mockAccRepo.On("GetCurrencyAggregations", mock.Anything, mock.Anything).Return(currencyAggs, nil).Once()

		result, err := service.GetAccountAggregations(context.Background(), userID)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Len(t, result.ByType, 3, "should have 3 account types")
		assert.Len(t, result.ByCurrency, 3, "should have 3 currencies")

		var totalTypeCount, totalCurrencyCount int
		for _, agg := range result.ByType {
			totalTypeCount += agg.Count
		}
		for _, agg := range result.ByCurrency {
			totalCurrencyCount += agg.Count
		}

		assert.Equal(t, 10, totalTypeCount, "total type count should be 10")
		assert.Equal(t, 10, totalCurrencyCount, "total currency count should be 10")
		assert.Equal(t, totalTypeCount, totalCurrencyCount, "both should sum to 10")
	})

	t.Run("same account type with different currencies stays separate", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()

		typeAggs := map[string]util.AggregationResult{
			"CHECKING": {Count: 3, Sum: 3000.00},
		}
		currencyAggs := map[string]util.AggregationResult{
			"USD": {Count: 1, Sum: 1000.00},
			"EUR": {Count: 1, Sum: 2000.00},
			"GBP": {Count: 1, Sum: 3000.00},
		}

		mockAccRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(typeAggs, nil).Once()
		mockAccRepo.On("GetCurrencyAggregations", mock.Anything, mock.Anything).Return(currencyAggs, nil).Once()

		result, err := service.GetAccountAggregations(context.Background(), userID)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Equal(t, 1, len(result.ByType), "should have 1 type (CHECKING)")
		assert.Equal(t, 3, len(result.ByCurrency), "should have 3 currencies")

		var currencyBalances []float64
		for _, agg := range result.ByCurrency {
			currencyBalances = append(currencyBalances, agg.Balance)
		}

		for i := 0; i < len(currencyBalances)-1; i++ {
			assert.NotEqual(t, currencyBalances[i], currencyBalances[i+1], "each currency should be isolated")
		}
	})
}

func TestBudgetRemainingCalculation(t *testing.T) {
	t.Run("remaining equals allocation minus spent", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		item1ID := uuid.New()
		item2ID := uuid.New()

		budget := &model.Budget{
			ID:       budgetID,
			Month:    month,
			Year:     year,
			Amount:   5000.00,
			UserID:   userID,
			Currency: "USD",
			BudgetItems: []model.BudgetItem{
				{ID: item1ID, BudgetID: &budgetID, Category: "Food", Allocation: 1000.00, Spent: 0},
				{ID: item2ID, BudgetID: &budgetID, Category: "Housing", Allocation: 2000.00, Spent: 0},
			},
		}

		spentMap := map[uuid.UUID]float64{
			item1ID: 300.00,
			item2ID: 1500.00,
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(spentMap, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		var foodItem, housingItem *BudgetPerformanceItem
		for i := range result.Items {
			if result.Items[i].Category == "Food" {
				foodItem = &result.Items[i]
			} else if result.Items[i].Category == "Housing" {
				housingItem = &result.Items[i]
			}
		}

		assert.NotNil(t, foodItem)
		assert.NotNil(t, housingItem)

		expectedFoodRemaining := 1000.00 - 300.00
		assert.Equal(t, expectedFoodRemaining, foodItem.Remaining, "Food remaining should be allocation minus spent")

		expectedHousingRemaining := 2000.00 - 1500.00
		assert.Equal(t, expectedHousingRemaining, housingItem.Remaining, "Housing remaining should be allocation minus spent")
	})

	t.Run("remaining is negative when spent exceeds allocation", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		itemID := uuid.New()

		budget := &model.Budget{
			ID:       budgetID,
			Month:    month,
			Year:     year,
			Amount:   1000.00,
			UserID:   userID,
			Currency: "USD",
			BudgetItems: []model.BudgetItem{
				{ID: itemID, BudgetID: &budgetID, Category: "Food", Allocation: 500.00, Spent: 0},
			},
		}

		spentMap := map[uuid.UUID]float64{
			itemID: 750.00,
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(spentMap, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Len(t, result.Items, 1)
		assert.Equal(t, -250.00, result.Items[0].Remaining, "remaining should be negative when over budget")
	})

	t.Run("total remaining equals sum of individual remainings", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		items := []model.BudgetItem{
			{ID: uuid.New(), BudgetID: &budgetID, Category: "Food", Allocation: 1000.00, Spent: 0},
			{ID: uuid.New(), BudgetID: &budgetID, Category: "Housing", Allocation: 1500.00, Spent: 0},
			{ID: uuid.New(), BudgetID: &budgetID, Category: "Utilities", Allocation: 500.00, Spent: 0},
		}

		budget := &model.Budget{
			ID:          budgetID,
			Month:       month,
			Year:        year,
			Amount:      3000.00,
			UserID:      userID,
			Currency:    "USD",
			BudgetItems: items,
		}

		spentMap := map[uuid.UUID]float64{
			items[0].ID: 200.00,
			items[1].ID: 1000.00,
			items[2].ID: 100.00,
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(spentMap, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		expectedTotalRemaining := (1000.00 - 200.00) + (1500.00 - 1000.00) + (500.00 - 100.00)
		assert.Equal(t, expectedTotalRemaining, result.TotalRemaining, "total remaining should equal sum of individual remainings")
	})

	t.Run("returns error when GetBudgetItemsSpent fails", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		itemID := uuid.New()

		budget := &model.Budget{
			ID:       budgetID,
			Month:    month,
			Year:     year,
			Amount:   1000.00,
			UserID:   userID,
			Currency: "USD",
			BudgetItems: []model.BudgetItem{
				{ID: itemID, BudgetID: &budgetID, Category: "Food", Allocation: 500.00},
			},
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("spent calculation error")).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "spent calculation error")
	})
}

func TestOverBudgetDetection(t *testing.T) {
	t.Run("is over budget flag is true when spent exceeds allocation", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		itemID := uuid.New()

		budget := &model.Budget{
			ID:       budgetID,
			Month:    month,
			Year:     year,
			Amount:   1000.00,
			UserID:   userID,
			Currency: "USD",
			BudgetItems: []model.BudgetItem{
				{ID: itemID, BudgetID: &budgetID, Category: "Food", Allocation: 500.00, Spent: 0},
			},
		}

		spentMap := map[uuid.UUID]float64{
			itemID: 600.00,
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(spentMap, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.True(t, result.Items[0].IsOverBudget, "IsOverBudget should be true when spent exceeds allocation")
	})

	t.Run("is over budget flag is false when within allocation", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		itemID := uuid.New()

		budget := &model.Budget{
			ID:       budgetID,
			Month:    month,
			Year:     year,
			Amount:   1000.00,
			UserID:   userID,
			Currency: "USD",
			BudgetItems: []model.BudgetItem{
				{ID: itemID, BudgetID: &budgetID, Category: "Food", Allocation: 500.00, Spent: 0},
			},
		}

		spentMap := map[uuid.UUID]float64{
			itemID: 400.00,
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(spentMap, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.False(t, result.Items[0].IsOverBudget, "IsOverBudget should be false when within allocation")
	})

	t.Run("is over budget flag is false when exactly at allocation", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		itemID := uuid.New()

		budget := &model.Budget{
			ID:       budgetID,
			Month:    month,
			Year:     year,
			Amount:   1000.00,
			UserID:   userID,
			Currency: "USD",
			BudgetItems: []model.BudgetItem{
				{ID: itemID, BudgetID: &budgetID, Category: "Food", Allocation: 500.00, Spent: 0},
			},
		}

		spentMap := map[uuid.UUID]float64{
			itemID: 500.00,
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(spentMap, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.False(t, result.Items[0].IsOverBudget, "IsOverBudget should be false when exactly at allocation")
	})
}

func TestBudgetUtilizationPercentage(t *testing.T) {
	t.Run("utilization percentage calculated correctly", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		itemID := uuid.New()

		budget := &model.Budget{
			ID:       budgetID,
			Month:    month,
			Year:     year,
			Amount:   1000.00,
			UserID:   userID,
			Currency: "USD",
			BudgetItems: []model.BudgetItem{
				{ID: itemID, BudgetID: &budgetID, Category: "Food", Allocation: 500.00, Spent: 0},
			},
		}

		spentMap := map[uuid.UUID]float64{
			itemID: 250.00,
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(spentMap, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		expectedPercentage := (250.00 / 500.00) * 100
		assert.Equal(t, expectedPercentage, result.Items[0].Percentage, "percentage should be spent/allocation * 100")
		assert.Equal(t, 50.00, result.Items[0].Percentage)
	})

	t.Run("utilization is 100% when spent equals allocation", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		itemID := uuid.New()

		budget := &model.Budget{
			ID:       budgetID,
			Month:    month,
			Year:     year,
			Amount:   1000.00,
			UserID:   userID,
			Currency: "USD",
			BudgetItems: []model.BudgetItem{
				{ID: itemID, BudgetID: &budgetID, Category: "Food", Allocation: 500.00, Spent: 0},
			},
		}

		spentMap := map[uuid.UUID]float64{
			itemID: 500.00,
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(spentMap, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Equal(t, 100.00, result.Items[0].Percentage)
	})

	t.Run("utilization exceeds 100% when over budget", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		itemID := uuid.New()

		budget := &model.Budget{
			ID:       budgetID,
			Month:    month,
			Year:     year,
			Amount:   1000.00,
			UserID:   userID,
			Currency: "USD",
			BudgetItems: []model.BudgetItem{
				{ID: itemID, BudgetID: &budgetID, Category: "Food", Allocation: 500.00, Spent: 0},
			},
		}

		spentMap := map[uuid.UUID]float64{
			itemID: 750.00,
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(spentMap, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Equal(t, 150.00, result.Items[0].Percentage)
		assert.True(t, result.Items[0].Percentage > 100)
	})
}

func TestUncategorizedTransactionHandling(t *testing.T) {
	t.Run("uncategorized transactions are grouped separately", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		categoryAggs := map[string]util.AggregationResult{
			"Food":          {Count: 5, Sum: 500.00},
			"Housing":       {Count: 2, Sum: 1500.00},
			"Uncategorized": {Count: 3, Sum: 200.00},
		}

		mockTxRepo.On("GetCategoryAggregations", mock.Anything, mock.Anything).Return(categoryAggs, nil).Once()

		result, err := service.GetExpenseBreakdown(context.Background(), userID, startDate, endDate)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		var uncategorizedItem *ExpenseBreakdownItem
		for i := range result.Items {
			if result.Items[i].Category == "Uncategorized" {
				uncategorizedItem = &result.Items[i]
				break
			}
		}

		assert.NotNil(t, uncategorizedItem, "Uncategorized transactions should be included")
		assert.Equal(t, 200.00, uncategorizedItem.Amount, "Uncategorized amount should match")
	})

	t.Run("empty string category is handled as uncategorized", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		categoryAggs := map[string]util.AggregationResult{
			"Food": {Count: 5, Sum: 500.00},
			"":     {Count: 2, Sum: 100.00},
		}

		mockTxRepo.On("GetCategoryAggregations", mock.Anything, mock.Anything).Return(categoryAggs, nil).Once()

		result, err := service.GetExpenseBreakdown(context.Background(), userID, startDate, endDate)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		var emptyCategoryItem *ExpenseBreakdownItem
		for i := range result.Items {
			if result.Items[i].Category == "" {
				emptyCategoryItem = &result.Items[i]
				break
			}
		}

		assert.NotNil(t, emptyCategoryItem, "Empty category should be included")
		assert.Equal(t, 100.00, emptyCategoryItem.Amount)
	})

	t.Run("total expenses include uncategorized", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		categoryAggs := map[string]util.AggregationResult{
			"Food":          {Sum: 500.00},
			"Housing":       {Sum: 1500.00},
			"Uncategorized": {Sum: 200.00},
		}

		mockTxRepo.On("GetCategoryAggregations", mock.Anything, mock.Anything).Return(categoryAggs, nil).Once()

		result, err := service.GetExpenseBreakdown(context.Background(), userID, startDate, endDate)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		expectedTotal := 500.00 + 1500.00 + 200.00
		assert.Equal(t, expectedTotal, result.TotalExpenses, "Total should include categorized and uncategorized")
	})
}

func TestCategoryPercentageSum(t *testing.T) {
	t.Run("percentages sum to 100%", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		categoryAggs := map[string]util.AggregationResult{
			"Food":          {Sum: 400.00},
			"Housing":       {Sum: 800.00},
			"Transport":     {Sum: 400.00},
			"Entertainment": {Sum: 400.00},
		}

		mockTxRepo.On("GetCategoryAggregations", mock.Anything, mock.Anything).Return(categoryAggs, nil).Once()

		result, err := service.GetExpenseBreakdown(context.Background(), userID, startDate, endDate)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		var sumPercentage float64
		for _, item := range result.Items {
			sumPercentage += item.Percentage
		}

		assert.InDelta(t, 100.0, sumPercentage, 0.01, "Percentages should sum to 100%")
	})

	t.Run("percentage calculation is accurate", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		categoryAggs := map[string]util.AggregationResult{
			"Food":    {Sum: 250.00},
			"Housing": {Sum: 750.00},
		}

		mockTxRepo.On("GetCategoryAggregations", mock.Anything, mock.Anything).Return(categoryAggs, nil).Once()

		result, err := service.GetExpenseBreakdown(context.Background(), userID, startDate, endDate)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		var foodPercentage, housingPercentage float64
		for _, item := range result.Items {
			if item.Category == "Food" {
				foodPercentage = item.Percentage
			} else if item.Category == "Housing" {
				housingPercentage = item.Percentage
			}
		}

		assert.Equal(t, 25.00, foodPercentage, "Food should be 25%")
		assert.Equal(t, 75.00, housingPercentage, "Housing should be 75%")
	})

	t.Run("percentages maintain proportions when total changes", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		categoryAggs := map[string]util.AggregationResult{
			"Food":    {Sum: 100.00},
			"Housing": {Sum: 400.00},
		}

		mockTxRepo.On("GetCategoryAggregations", mock.Anything, mock.Anything).Return(categoryAggs, nil).Once()

		result, err := service.GetExpenseBreakdown(context.Background(), userID, startDate, endDate)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		var foodPercentage, housingPercentage float64
		for _, item := range result.Items {
			if item.Category == "Food" {
				foodPercentage = item.Percentage
			} else if item.Category == "Housing" {
				housingPercentage = item.Percentage
			}
		}

		assert.Equal(t, 20.00, foodPercentage, "Food should remain 20%")
		assert.Equal(t, 80.00, housingPercentage, "Housing should remain 80%")
		assert.Equal(t, foodPercentage*4, housingPercentage, "Housing should be 4x Food percentage")
	})
}

func TestDateRangeFiltering(t *testing.T) {
	t.Run("transactions outside date range are excluded", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		currentAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 5000.00},
			"EXPENSE": {Sum: 3000.00},
		}
		prevAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 4000.00},
			"EXPENSE": {Sum: 2000.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(currentAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(prevAggs, nil).Once()
		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return((*model.Budget)(nil), nil)

		params := SummaryParams{
			UserID:    userID,
			StartDate: &startDate,
			EndDate:   &endDate,
		}

		result, err := service.GetSummary(context.Background(), params)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Equal(t, 5000.00, result.Income.Amount)
		assert.Equal(t, 3000.00, result.Expenses.Amount)
	})

	t.Run("different date ranges produce different results", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()

		janAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 5000.00},
			"EXPENSE": {Sum: 3000.00},
		}
		janPrevAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 4000.00},
			"EXPENSE": {Sum: 2500.00},
		}
		febAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 4000.00},
			"EXPENSE": {Sum: 2500.00},
		}
		febPrevAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 3500.00},
			"EXPENSE": {Sum: 2000.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(janAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(janPrevAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(febAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(febPrevAggs, nil).Once()
		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return((*model.Budget)(nil), nil).Twice()

		janStart := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		janEnd := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)
		febStart := time.Date(2025, 2, 1, 0, 0, 0, 0, time.UTC)
		febEnd := time.Date(2025, 2, 28, 23, 59, 59, 0, time.UTC)

		janParams := SummaryParams{
			UserID:    userID,
			StartDate: &janStart,
			EndDate:   &janEnd,
		}

		febParams := SummaryParams{
			UserID:    userID,
			StartDate: &febStart,
			EndDate:   &febEnd,
		}

		janResult, err := service.GetSummary(context.Background(), janParams)
		assert.NoError(t, err)

		febResult, err := service.GetSummary(context.Background(), febParams)
		assert.NoError(t, err)

		assert.NotEqual(t, janResult.Income.Amount, febResult.Income.Amount, "Income should differ between months")
		assert.NotEqual(t, janResult.Expenses.Amount, febResult.Expenses.Amount, "Expenses should differ between months")
	})

	t.Run("empty date range returns zero", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()

		emptyAggs := map[string]util.AggregationResult{}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(emptyAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(emptyAggs, nil).Once()
		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return((*model.Budget)(nil), nil)

		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)

		params := SummaryParams{
			UserID:    userID,
			StartDate: &startDate,
			EndDate:   &endDate,
		}

		result, err := service.GetSummary(context.Background(), params)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Equal(t, 0.0, result.Income.Amount, "Empty date range should return zero income")
		assert.Equal(t, 0.0, result.Expenses.Amount, "Empty date range should return zero expenses")
	})
}

func TestTimeBasedAggregationCompleteness(t *testing.T) {
	t.Run("day granularity covers all days in range", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 3, 23, 59, 59, 0, time.UTC)

		initialAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 600.00},
			"EXPENSE": {Sum: 300.00},
		}
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(initialAggs, nil).Once()

		for d := 1; d <= 3; d++ {
			dayAggs := map[string]util.AggregationResult{
				"INCOME":  {Sum: 100.00 * float64(d)},
				"EXPENSE": {Sum: 50.00 * float64(d)},
			}
			mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(dayAggs, nil).Once()
		}

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "day")
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Len(t, result.Trends, 3, "Should have 3 days of trends")
	})

	t.Run("week granularity produces correct number of periods", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 21, 23, 59, 59, 0, time.UTC)

		initialAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 1500.00},
			"EXPENSE": {Sum: 900.00},
		}
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(initialAggs, nil).Once()

		for i := 0; i < 3; i++ {
			weekAggs := map[string]util.AggregationResult{
				"INCOME":  {Sum: 500.00},
				"EXPENSE": {Sum: 300.00},
			}
			mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(weekAggs, nil).Once()
		}

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "week")
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Len(t, result.Trends, 3, "Should have 3 weeks of trends")
	})

	t.Run("month granularity aggregates correctly", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 3, 31, 23, 59, 59, 0, time.UTC)

		initialAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 15000.00},
			"EXPENSE": {Sum: 9000.00},
		}
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(initialAggs, nil).Once()

		monthAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 5000.00},
			"EXPENSE": {Sum: 3000.00},
		}

		for i := 0; i < 3; i++ {
			mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(monthAggs, nil).Once()
		}

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "month")
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Len(t, result.Trends, 3, "Should have 3 months of trends")

		for _, trend := range result.Trends {
			assert.Contains(t, trend.Period, "-", "Month period should contain dash")
		}
	})
}

func TestTransactionTypeSeparation(t *testing.T) {
	t.Run("income and expenses are separated correctly", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		agg := map[string]util.AggregationResult{
			"INCOME":  {Sum: 5000.00},
			"EXPENSE": {Sum: 3000.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(agg, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(agg, nil).Once()

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "month")
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Len(t, result.Trends, 1)
		assert.Equal(t, 5000.00, result.Trends[0].Income)
		assert.Equal(t, 3000.00, result.Trends[0].Expenses)
		assert.Equal(t, 2000.00, result.Trends[0].NetFlow)
	})

	t.Run("net flow is calculated as income minus expenses", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		agg := map[string]util.AggregationResult{
			"INCOME":  {Sum: 10000.00},
			"EXPENSE": {Sum: 7500.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(agg, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(agg, nil).Once()

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "month")
		assert.NoError(t, err)
		assert.NotNil(t, result)

		expectedNetFlow := agg["INCOME"].Sum - agg["EXPENSE"].Sum
		assert.Equal(t, expectedNetFlow, result.Trends[0].NetFlow)
		assert.Equal(t, 2500.00, result.Trends[0].NetFlow)
	})

	t.Run("no income results in negative net flow", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		agg := map[string]util.AggregationResult{
			"INCOME":  {Sum: 0.00},
			"EXPENSE": {Sum: 5000.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(agg, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(agg, nil).Once()

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "month")
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Equal(t, -5000.00, result.Trends[0].NetFlow)
		assert.True(t, result.Trends[0].NetFlow < 0, "Net flow should be negative when expenses exceed income")
	})

	t.Run("only expenses are included in expense breakdown", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		categoryAggs := map[string]util.AggregationResult{
			"Food":    {Sum: 300.00},
			"Housing": {Sum: 1200.00},
		}

		mockTxRepo.On("GetCategoryAggregations", mock.Anything, mock.Anything).Return(categoryAggs, nil).Once()

		result, err := service.GetExpenseBreakdown(context.Background(), userID, startDate, endDate)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Equal(t, 1500.00, result.TotalExpenses, "Total expenses should only include expense categories")

		for _, item := range result.Items {
			assert.NotEqual(t, "Salary", item.Category, "Income category should not be in expense breakdown")
		}
	})

	t.Run("default granularity uses total", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		agg := map[string]util.AggregationResult{
			"INCOME":  {Sum: 5000.00},
			"EXPENSE": {Sum: 3000.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(agg, nil).Once()

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "invalid")
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Equal(t, "invalid", result.Granularity)
		assert.Len(t, result.Trends, 1)
		assert.Equal(t, "total", result.Trends[0].Period)
		assert.Equal(t, 5000.00, result.Trends[0].Income)
		assert.Equal(t, 3000.00, result.Trends[0].Expenses)
		assert.Equal(t, 2000.00, result.Trends[0].NetFlow)
	})

	t.Run("empty aggregation maps returns empty results", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()

		typeAggs := map[string]util.AggregationResult{}
		currencyAggs := map[string]util.AggregationResult{}

		mockAccRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(typeAggs, nil).Once()
		mockAccRepo.On("GetCurrencyAggregations", mock.Anything, mock.Anything).Return(currencyAggs, nil).Once()

		result, err := service.GetAccountAggregations(context.Background(), userID)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Empty(t, result.ByType)
		assert.Empty(t, result.ByCurrency)
	})

	t.Run("budget with no items returns zero totals", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budget := &model.Budget{
			ID:          uuid.New(),
			Month:       month,
			Year:        year,
			Amount:      0,
			UserID:      userID,
			Currency:    "USD",
			BudgetItems: []model.BudgetItem{},
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(map[uuid.UUID]float64{}, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Empty(t, result.Items)
		assert.Equal(t, 0.0, result.TotalAllocated)
		assert.Equal(t, 0.0, result.TotalSpent)
		assert.Equal(t, 0.0, result.TotalRemaining)
		assert.Equal(t, 0.0, result.OverallPercentage)
	})

	t.Run("nil budget returns result with no items", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return((*model.Budget)(nil), nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Empty(t, result.Items)
		assert.Equal(t, month, result.Month)
		assert.Equal(t, year, result.Year)
	})

	t.Run("empty category aggregations returns zero total", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		categoryAggs := map[string]util.AggregationResult{}

		mockTxRepo.On("GetCategoryAggregations", mock.Anything, mock.Anything).Return(categoryAggs, nil).Once()

		result, err := service.GetExpenseBreakdown(context.Background(), userID, startDate, endDate)
		assert.NoError(t, err)
		assert.NotNil(t, result)

		assert.Equal(t, 0.0, result.TotalExpenses)
		assert.Empty(t, result.Items)
	})

	t.Run("returns error when GetCategoryAggregations fails", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		mockTxRepo.On("GetCategoryAggregations", mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("category aggregation error")).Once()

		result, err := service.GetExpenseBreakdown(context.Background(), userID, startDate, endDate)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "category aggregation error")
	})
}

func TestGetBudgetPerformanceWithMultipleItems(t *testing.T) {
	t.Run("calculates correct totals with multiple budget items", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		foodItemID := uuid.New()
		housingItemID := uuid.New()
		transportItemID := uuid.New()

		budget := &model.Budget{
			ID:       budgetID,
			Month:    month,
			Year:     year,
			Amount:   3000.00,
			UserID:   userID,
			Currency: "USD",
			BudgetItems: []model.BudgetItem{
				{ID: foodItemID, BudgetID: &budgetID, Category: "Food", Allocation: 500.00},
				{ID: housingItemID, BudgetID: &budgetID, Category: "Housing", Allocation: 2000.00},
				{ID: transportItemID, BudgetID: &budgetID, Category: "Transport", Allocation: 500.00},
			},
		}

		spentMap := map[uuid.UUID]float64{
			foodItemID:      450.00,
			housingItemID:   2000.00,
			transportItemID: 300.00,
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(spentMap, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, month, result.Month)
		assert.Equal(t, year, result.Year)
		assert.Len(t, result.Items, 3)

		assert.Equal(t, 500.00, result.Items[0].Allocated)
		assert.Equal(t, 450.00, result.Items[0].Spent)
		assert.Equal(t, 50.00, result.Items[0].Remaining)
		assert.Equal(t, 90.0, result.Items[0].Percentage)
		assert.False(t, result.Items[0].IsOverBudget)

		assert.Equal(t, 2000.00, result.Items[1].Allocated)
		assert.Equal(t, 2000.00, result.Items[1].Spent)
		assert.Equal(t, 0.0, result.Items[1].Remaining)
		assert.Equal(t, 100.0, result.Items[1].Percentage)
		assert.False(t, result.Items[1].IsOverBudget)

		assert.Equal(t, 500.00, result.Items[2].Allocated)
		assert.Equal(t, 300.00, result.Items[2].Spent)
		assert.Equal(t, 200.00, result.Items[2].Remaining)
		assert.Equal(t, 60.0, result.Items[2].Percentage)
		assert.False(t, result.Items[2].IsOverBudget)

		assert.Equal(t, 3000.00, result.TotalAllocated)
		assert.Equal(t, 2750.00, result.TotalSpent)
		assert.Equal(t, 250.00, result.TotalRemaining)
		assert.InDelta(t, 91.67, result.OverallPercentage, 0.01)
	})

	t.Run("handles over-budget items correctly", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		itemID := uuid.New()

		budget := &model.Budget{
			ID:       budgetID,
			Month:    month,
			Year:     year,
			Amount:   500.00,
			UserID:   userID,
			Currency: "USD",
			BudgetItems: []model.BudgetItem{
				{ID: itemID, BudgetID: &budgetID, Category: "Food", Allocation: 500.00},
			},
		}

		spentMap := map[uuid.UUID]float64{
			itemID: 600.00,
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(spentMap, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Items, 1)

		assert.Equal(t, 500.00, result.TotalAllocated)
		assert.Equal(t, 600.00, result.TotalSpent)
		assert.Equal(t, -100.00, result.TotalRemaining)
		assert.Equal(t, 120.0, result.Items[0].Percentage)
		assert.True(t, result.Items[0].IsOverBudget)
		assert.True(t, result.OverallPercentage > 100.0)
	})

	t.Run("handles zero allocation items correctly", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		month := 1
		year := 2025

		budgetID := uuid.New()
		zeroItemID := uuid.New()
		normalItemID := uuid.New()

		budget := &model.Budget{
			ID:       budgetID,
			Month:    month,
			Year:     year,
			Amount:   500.00,
			UserID:   userID,
			Currency: "USD",
			BudgetItems: []model.BudgetItem{
				{ID: zeroItemID, BudgetID: &budgetID, Category: "Savings", Allocation: 0.00},
				{ID: normalItemID, BudgetID: &budgetID, Category: "Food", Allocation: 500.00},
			},
		}

		spentMap := map[uuid.UUID]float64{
			zeroItemID:   0.00,
			normalItemID: 250.00,
		}

		mockBudgetRepo.On("FindUnique", mock.Anything, mock.Anything).Return(budget, nil).Once()
		mockBudgetRepo.On("GetBudgetItemsSpent", mock.Anything, mock.Anything).Return(spentMap, nil).Once()

		result, err := service.GetBudgetPerformance(context.Background(), userID, month, year)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Items, 2)

		assert.Equal(t, 0.0, result.Items[0].Allocated)
		assert.Equal(t, 0.0, result.Items[0].Percentage)
		assert.Equal(t, 0.0, result.Items[0].Spent)
		assert.Equal(t, 0.0, result.Items[0].Remaining)
		assert.False(t, result.Items[0].IsOverBudget)

		assert.Equal(t, 500.00, result.Items[1].Allocated)
		assert.Equal(t, 50.0, result.Items[1].Percentage)
		assert.Equal(t, 250.00, result.Items[1].Spent)

		assert.Equal(t, 500.00, result.TotalAllocated)
		assert.Equal(t, 250.00, result.TotalSpent)
		assert.Equal(t, 50.0, result.OverallPercentage)
	})
}

func TestGetTransactionTrendsWeekGranularity(t *testing.T) {
	t.Run("week granularity with exact boundary dates", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 12, 23, 59, 59, 0, time.UTC)

		initialAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 1000.00},
			"EXPENSE": {Sum: 500.00},
		}

		weekAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 1000.00},
			"EXPENSE": {Sum: 500.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(initialAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(weekAggs, nil).Once()

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "week")

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Trends, 1)
		assert.Equal(t, 1000.00, result.Trends[0].Income)
		assert.Equal(t, 500.00, result.Trends[0].Expenses)
		assert.Equal(t, 500.00, result.Trends[0].NetFlow)
	})

	t.Run("month granularity with single month range", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)

		initialAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 5000.00},
			"EXPENSE": {Sum: 3000.00},
		}

		monthAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 5000.00},
			"EXPENSE": {Sum: 3000.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(initialAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(monthAggs, nil).Once()

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "month")

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Trends, 1)
		assert.Equal(t, "2025-01", result.Trends[0].Period)
		assert.Equal(t, 5000.00, result.Trends[0].Income)
		assert.Equal(t, 3000.00, result.Trends[0].Expenses)
		assert.Equal(t, 2000.00, result.Trends[0].NetFlow)
	})

	t.Run("day granularity with short range tests boundary conditions", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 28, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 30, 23, 59, 59, 0, time.UTC)

		initialAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 3000.00},
			"EXPENSE": {Sum: 1500.00},
		}

		dayAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 1000.00},
			"EXPENSE": {Sum: 500.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(initialAggs, nil).Once()
		for i := 0; i < 3; i++ {
			mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(dayAggs, nil).Once()
		}

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "day")

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Trends, 3)
		assert.Equal(t, "2025-01-28", result.Trends[0].Period)
		assert.Equal(t, "2025-01-29", result.Trends[1].Period)
		assert.Equal(t, "2025-01-30", result.Trends[2].Period)
	})

	t.Run("month granularity spanning year boundary", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2024, 12, 15, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 15, 23, 59, 59, 0, time.UTC)

		initialAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 4000.00},
			"EXPENSE": {Sum: 2000.00},
		}

		monthAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 2000.00},
			"EXPENSE": {Sum: 1000.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(initialAggs, nil).Once()
		for i := 0; i < 2; i++ {
			mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(monthAggs, nil).Once()
		}

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "month")

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Trends, 2)
		assert.Equal(t, "2024-12", result.Trends[0].Period)
		assert.Equal(t, "2025-01", result.Trends[1].Period)
	})

	t.Run("week granularity error handling", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 20, 23, 59, 59, 0, time.UTC)

		initialAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 2000.00},
			"EXPENSE": {Sum: 1000.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(initialAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("week aggregation error")).Once()

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "week")

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "week aggregation error")
	})

	t.Run("month granularity error handling", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 3, 31, 23, 59, 59, 0, time.UTC)

		initialAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 6000.00},
			"EXPENSE": {Sum: 3000.00},
		}

		monthAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 2000.00},
			"EXPENSE": {Sum: 1000.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(initialAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(monthAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("month aggregation error")).Once()

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "month")

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "month aggregation error")
	})

	t.Run("day granularity with single day boundary test", func(t *testing.T) {
		mockTxRepo := new(MockTransactionRepository)
		mockBudgetRepo := new(MockBudgetRepository)
		mockAccRepo := new(MockAccountRepository)

		service := NewDashboardService(mockTxRepo, mockBudgetRepo, mockAccRepo)

		userID := uuid.New()
		startDate := time.Date(2025, 1, 15, 0, 0, 0, 0, time.UTC)
		endDate := time.Date(2025, 1, 15, 23, 59, 59, 0, time.UTC)

		initialAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 500.00},
			"EXPENSE": {Sum: 200.00},
		}

		dayAggs := map[string]util.AggregationResult{
			"INCOME":  {Sum: 500.00},
			"EXPENSE": {Sum: 200.00},
		}

		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(initialAggs, nil).Once()
		mockTxRepo.On("GetTypeAggregations", mock.Anything, mock.Anything).Return(dayAggs, nil).Once()

		result, err := service.GetTransactionTrends(context.Background(), userID, startDate, endDate, "day")

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Trends, 1)
		assert.Equal(t, "2025-01-15", result.Trends[0].Period)
		assert.Equal(t, 500.00, result.Trends[0].Income)
		assert.Equal(t, 200.00, result.Trends[0].Expenses)
		assert.Equal(t, 300.00, result.Trends[0].NetFlow)
	})
}
