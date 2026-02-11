package dashboard

import (
	"context"
	"fmt"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/account"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/budget"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/investment"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/transaction"
)

// Service orchestrates cross-context read operations for the dashboard
type Service struct {
	accountRepo     account.Repository
	transactionRepo transaction.Repository
	budgetRepo      BudgetRepository
	assetRepo       AssetRepository
	liabilityRepo   LiabilityRepository
}

// BudgetRepository defines the budget repository interface needed by dashboard
type BudgetRepository interface {
	FindByUser(ctx context.Context, userID shared.UserID) ([]*budget.Budget, error)
}

// AssetRepository defines the asset repository interface needed by dashboard
type AssetRepository interface {
	FindByUserID(ctx context.Context, userID shared.UserID) ([]*investment.Asset, error)
}

// LiabilityRepository defines the liability repository interface needed by dashboard
type LiabilityRepository interface {
	FindByUserID(ctx context.Context, userID shared.UserID) ([]*investment.Liability, error)
}

// NewService creates a new dashboard service
func NewService(
	accountRepo account.Repository,
	transactionRepo transaction.Repository,
	budgetRepo BudgetRepository,
	assetRepo AssetRepository,
	liabilityRepo LiabilityRepository,
) *Service {
	return &Service{
		accountRepo:     accountRepo,
		transactionRepo: transactionRepo,
		budgetRepo:      budgetRepo,
		assetRepo:       assetRepo,
		liabilityRepo:   liabilityRepo,
	}
}

// DashboardSummary contains summary data for the dashboard
type DashboardSummary struct {
	TotalBalance     float64
	TotalAssets      float64
	TotalLiabilities float64
	NetWorth         float64
	MonthlyIncome    float64
	MonthlyExpenses  float64
	TransactionCount int
	AccountCount     int
	BudgetCount      int
	Currency         shared.Currency
	Period           Period
}

// Period defines a time period for summaries
type Period struct {
	StartDate time.Time
	EndDate   time.Time
}

// GetSummary retrieves a summary for a user's dashboard
func (s *Service) GetSummary(ctx context.Context, userID shared.UserID, currency shared.Currency, period Period) (*DashboardSummary, error) {
	// Get accounts
	accounts, err := s.accountRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get accounts: %w", err)
	}

	// Calculate total balance
	totalBalance := 0.0
	for _, acc := range accounts {
		if !acc.IsDeleted() && acc.Currency() == currency {
			totalBalance += acc.Balance()
		}
	}

	// Get transactions for the period
	txnParams := transaction.FindManyParams{
		UserID:    userID,
		StartDate: &period.StartDate,
		EndDate:   &period.EndDate,
	}

	txnResult, err := s.transactionRepo.FindMany(ctx, txnParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get transactions: %w", err)
	}

	// Calculate income/expenses
	income := 0.0
	expenses := 0.0
	for _, txn := range txnResult.Transactions {
		if !txn.IsDeleted() && txn.Currency() == currency {
			if txn.Type().IsIncome() {
				income += txn.Amount()
			} else {
				expenses += txn.Amount()
			}
		}
	}

	// Get assets and liabilities for net worth
	assets, err := s.assetRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get assets: %w", err)
	}

	liabilities, err := s.liabilityRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get liabilities: %w", err)
	}

	totalAssets := 0.0
	for _, asset := range assets {
		if !asset.IsDeleted() && asset.Currency() == currency {
			totalAssets += asset.Value()
		}
	}

	totalLiabilities := 0.0
	for _, liability := range liabilities {
		if !liability.IsDeleted() && liability.Currency() == currency {
			totalLiabilities += liability.RemainingAmount()
		}
	}

	// Get budgets count
	budgets, err := s.budgetRepo.FindByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get budgets: %w", err)
	}

	return &DashboardSummary{
		TotalBalance:     totalBalance,
		TotalAssets:      totalAssets,
		TotalLiabilities: totalLiabilities,
		NetWorth:         totalAssets - totalLiabilities,
		MonthlyIncome:    income,
		MonthlyExpenses:  expenses,
		TransactionCount: len(txnResult.Transactions),
		AccountCount:     len(accounts),
		BudgetCount:      len(budgets),
		Currency:         currency,
		Period:           period,
	}, nil
}

// GetMonthlySummary retrieves a summary for a specific month
func (s *Service) GetMonthlySummary(ctx context.Context, userID shared.UserID, currency shared.Currency, year int, month int) (*DashboardSummary, error) {
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, -1) // Last day of the month

	period := Period{
		StartDate: startDate,
		EndDate:   endDate,
	}

	return s.GetSummary(ctx, userID, currency, period)
}

// GetCurrentMonthSummary retrieves a summary for the current month
func (s *Service) GetCurrentMonthSummary(ctx context.Context, userID shared.UserID, currency shared.Currency) (*DashboardSummary, error) {
	now := time.Now()
	startDate := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, -1)

	period := Period{
		StartDate: startDate,
		EndDate:   endDate,
	}

	return s.GetSummary(ctx, userID, currency, period)
}
