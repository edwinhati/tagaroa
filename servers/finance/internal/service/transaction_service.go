package service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrTransactionAccessDenied  = errors.New("access denied")
	ErrTransactionNotFound      = errors.New("transaction not found")
	ErrTransactionInvalidAmount = errors.New("invalid amount")
	ErrInvalidTransactionType   = errors.New("invalid transaction type")
)

type GetTransactionsParams struct {
	UserID     uuid.UUID
	Page       int
	Limit      int
	Types      []string
	Currencies []string
	Accounts   []string
	Categories []string
	StartDate  *time.Time
	EndDate    *time.Time
	OrderBy    string
}

type GetTransactionsResult struct {
	Transactions         []*model.Transaction
	Total                int
	TypeAggregations     map[string]util.AggregationResult
	CurrencyAggregations map[string]util.AggregationResult
	AccountAggregations  map[string]util.AggregationResult
	CategoryAggregations map[string]util.AggregationResult
}

type UpdateTransactionInput struct {
	Amount       *float64
	Date         *time.Time
	Type         *model.TransactionType
	Currency     *string
	Notes        *string
	Files        []string
	AccountID    *string
	BudgetItemID *string
}

type TransactionService interface {
	CreateTransaction(ctx context.Context, transaction *model.Transaction) (*model.Transaction, error)
	GetTransaction(ctx context.Context, id, userID uuid.UUID) (*model.Transaction, error)
	GetTransactions(ctx context.Context, params GetTransactionsParams) (*GetTransactionsResult, error)
	UpdateTransaction(ctx context.Context, id uuid.UUID, input UpdateTransactionInput, userID uuid.UUID) (*model.Transaction, error)
	DeleteTransaction(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}

type transactionService struct {
	transactionRepo repository.TransactionRepository
	accountRepo     repository.AccountRepository
}

func NewTransactionService(transactionRepo repository.TransactionRepository, accountRepo repository.AccountRepository) TransactionService {
	return &transactionService{
		transactionRepo: transactionRepo,
		accountRepo:     accountRepo,
	}
}

func (s *transactionService) CreateTransaction(ctx context.Context, transaction *model.Transaction) (*model.Transaction, error) {
	// Validate transaction type
	if !isValidTransactionType(transaction.Type) {
		return nil, ErrInvalidTransactionType
	}

	if err := s.transactionRepo.Create(ctx, transaction); err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	// Update account balance
	if err := s.updateAccountBalance(ctx, transaction.AccountID, transaction.Amount, transaction.Type); err != nil {
		return nil, fmt.Errorf("failed to update account balance: %w", err)
	}

	return transaction, nil
}

func (s *transactionService) GetTransaction(ctx context.Context, id, userID uuid.UUID) (*model.Transaction, error) {
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      id,
			"user_id": userID,
		},
	}

	transaction, err := s.transactionRepo.FindUnique(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}
	if transaction == nil {
		return nil, ErrTransactionNotFound
	}

	return transaction, nil
}

func (s *transactionService) GetTransactions(ctx context.Context, params GetTransactionsParams) (*GetTransactionsResult, error) {
	// Calculate offset from page
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 {
		params.Limit = 10
	}
	offset := (params.Page - 1) * params.Limit

	whereClause := map[string]any{
		"user_id": params.UserID,
	}

	// Add date range filters
	if params.StartDate != nil {
		whereClause["start_date"] = *params.StartDate
	}
	if params.EndDate != nil {
		whereClause["end_date"] = *params.EndDate
	}

	// Add multi-select filters
	if len(params.Types) > 0 {
		whereClause["type"] = params.Types
	}

	if len(params.Currencies) > 0 {
		whereClause["currency"] = params.Currencies
	}

	if len(params.Accounts) > 0 {
		whereClause["account"] = params.Accounts
	}

	if len(params.Categories) > 0 {
		whereClause["category"] = params.Categories
	}

	// Get type aggregations (excluding type filter to show all available types)
	typeAggregationWhere := map[string]any{
		"user_id": params.UserID,
	}
	if params.StartDate != nil {
		typeAggregationWhere["start_date"] = *params.StartDate
	}
	if params.EndDate != nil {
		typeAggregationWhere["end_date"] = *params.EndDate
	}
	if len(params.Currencies) > 0 {
		typeAggregationWhere["currency"] = params.Currencies
	}
	if len(params.Accounts) > 0 {
		typeAggregationWhere["account"] = params.Accounts
	}
	if len(params.Categories) > 0 {
		typeAggregationWhere["category"] = params.Categories
	}
	typeAggregations, err := s.transactionRepo.GetTypeAggregations(ctx, typeAggregationWhere)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction type aggregations: %w", err)
	}

	// Get currency aggregations (excluding currency filter to show all available currencies)
	currencyAggregationWhere := map[string]any{
		"user_id": params.UserID,
	}
	if params.StartDate != nil {
		currencyAggregationWhere["start_date"] = *params.StartDate
	}
	if params.EndDate != nil {
		currencyAggregationWhere["end_date"] = *params.EndDate
	}
	if len(params.Types) > 0 {
		currencyAggregationWhere["type"] = params.Types
	}
	if len(params.Accounts) > 0 {
		currencyAggregationWhere["account"] = params.Accounts
	}
	if len(params.Categories) > 0 {
		currencyAggregationWhere["category"] = params.Categories
	}
	currencyAggregations, err := s.transactionRepo.GetCurrencyAggregations(ctx, currencyAggregationWhere)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction currency aggregations: %w", err)
	}

	// Get account aggregations
	accountAggregationWhere := map[string]any{
		"user_id": params.UserID,
	}
	if params.StartDate != nil {
		accountAggregationWhere["start_date"] = *params.StartDate
	}
	if params.EndDate != nil {
		accountAggregationWhere["end_date"] = *params.EndDate
	}
	if len(params.Types) > 0 {
		accountAggregationWhere["type"] = params.Types
	}
	if len(params.Currencies) > 0 {
		accountAggregationWhere["currency"] = params.Currencies
	}
	if len(params.Categories) > 0 {
		accountAggregationWhere["category"] = params.Categories
	}
	accountAggregations, err := s.transactionRepo.GetAccountAggregations(ctx, accountAggregationWhere)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction account aggregations: %w", err)
	}

	// Get category aggregations
	categoryAggregationWhere := map[string]any{
		"user_id": params.UserID,
	}
	if params.StartDate != nil {
		categoryAggregationWhere["start_date"] = *params.StartDate
	}
	if params.EndDate != nil {
		categoryAggregationWhere["end_date"] = *params.EndDate
	}
	if len(params.Types) > 0 {
		categoryAggregationWhere["type"] = params.Types
	}
	if len(params.Currencies) > 0 {
		categoryAggregationWhere["currency"] = params.Currencies
	}
	if len(params.Accounts) > 0 {
		categoryAggregationWhere["account"] = params.Accounts
	}
	categoryAggregations, err := s.transactionRepo.GetCategoryAggregations(ctx, categoryAggregationWhere)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction category aggregations: %w", err)
	}

	// Get total count for pagination
	total, err := s.transactionRepo.Count(ctx, whereClause)
	if err != nil {
		return nil, fmt.Errorf("failed to count user transactions: %w", err)
	}

	repoParams := util.FindManyParams{
		Offset:  offset,
		Limit:   params.Limit,
		Where:   whereClause,
		OrderBy: params.OrderBy,
	}

	// Set default ordering if not provided
	if repoParams.OrderBy == "" {
		repoParams.OrderBy = "created_at DESC"
	}

	transactions, err := s.transactionRepo.FindMany(ctx, repoParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get user transactions: %w", err)
	}

	result := &GetTransactionsResult{
		Transactions:         transactions,
		Total:                total,
		TypeAggregations:     typeAggregations,
		CurrencyAggregations: currencyAggregations,
		AccountAggregations:  accountAggregations,
		CategoryAggregations: categoryAggregations,
	}

	return result, nil
}

func (s *transactionService) UpdateTransaction(ctx context.Context, id uuid.UUID, input UpdateTransactionInput, userID uuid.UUID) (*model.Transaction, error) {
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      id,
			"user_id": userID,
		},
	}

	transaction, err := s.transactionRepo.FindUnique(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}
	if transaction == nil {
		return nil, ErrTransactionNotFound
	}

	// Store old values for balance adjustment
	oldAmount := transaction.Amount
	oldType := transaction.Type
	oldAccountID := transaction.AccountID

	// Update fields if provided
	if input.Amount != nil {
		transaction.Amount = *input.Amount
	}
	if input.Date != nil {
		transaction.Date = *input.Date
	}
	if input.Type != nil {
		transaction.Type = *input.Type
	}
	if input.Currency != nil {
		transaction.Currency = *input.Currency
	}
	if input.Notes != nil {
		transaction.Notes = input.Notes
	}
	if len(input.Files) >= 0 {
		transaction.Files = input.Files
	}
	if input.AccountID != nil {
		if *input.AccountID == "" {
			return nil, fmt.Errorf("account_id cannot be empty")
		} else {
			accountID, err := uuid.Parse(*input.AccountID)
			if err != nil {
				return nil, fmt.Errorf("invalid account_id format: %w", err)
			}
			transaction.AccountID = accountID
		}
	}
	if input.BudgetItemID != nil {
		if *input.BudgetItemID == "" || strings.ToLower(*input.BudgetItemID) == "none" || strings.ToLower(*input.BudgetItemID) == "null" {
			transaction.BudgetItemID = nil
		} else {
			budgetItemID, err := uuid.Parse(*input.BudgetItemID)
			if err != nil {
				return nil, fmt.Errorf("invalid budget_item_id format: %w", err)
			}
			transaction.BudgetItemID = &budgetItemID
		}
	}

	if err := s.transactionRepo.Update(ctx, transaction); err != nil {
		return nil, fmt.Errorf("failed to update transaction: %w", err)
	}

	// Adjust account balance if amount, type, or account changed
	if oldAmount != transaction.Amount || oldType != transaction.Type || oldAccountID != transaction.AccountID {
		// Reverse old transaction effect on old account
		if err := s.reverseAccountBalance(ctx, oldAccountID, oldAmount, oldType); err != nil {
			return nil, fmt.Errorf("failed to reverse old account balance: %w", err)
		}
		// Apply new transaction effect on new account
		if err := s.updateAccountBalance(ctx, transaction.AccountID, transaction.Amount, transaction.Type); err != nil {
			return nil, fmt.Errorf("failed to update new account balance: %w", err)
		}
	}

	return transaction, nil
}

func (s *transactionService) DeleteTransaction(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      id,
			"user_id": userID,
		},
	}

	transaction, err := s.transactionRepo.FindUnique(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to get transaction: %w", err)
	}
	if transaction == nil {
		return ErrTransactionNotFound
	}

	now := time.Now()
	transaction.DeletedAt = &now

	if err := s.transactionRepo.Update(ctx, transaction); err != nil {
		return fmt.Errorf("failed to delete transaction: %w", err)
	}

	// Reverse the transaction effect on account balance
	if err := s.reverseAccountBalance(ctx, transaction.AccountID, transaction.Amount, transaction.Type); err != nil {
		return fmt.Errorf("failed to reverse account balance: %w", err)
	}

	return nil
}

func isValidTransactionType(transactionType model.TransactionType) bool {
	validTypes := model.TransactionTypes()
	return slices.Contains(validTypes, transactionType)
}

// updateAccountBalance adjusts account balance based on transaction type
// INCOME increases balance, EXPENSE decreases balance
func (s *transactionService) updateAccountBalance(ctx context.Context, accountID uuid.UUID, amount float64, txType model.TransactionType) error {
	account, err := s.accountRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"id": accountID},
	})
	if err != nil {
		return err
	}
	if account == nil {
		return fmt.Errorf("account not found: %s", accountID)
	}

	switch txType {
	case model.TransactionTypeIncome:
		account.Balance += amount
	case model.TransactionTypeExpense:
		account.Balance -= amount
	}

	return s.accountRepo.Update(ctx, account)
}

// reverseAccountBalance reverses the effect of a transaction on account balance
// Used when updating or deleting transactions
func (s *transactionService) reverseAccountBalance(ctx context.Context, accountID uuid.UUID, amount float64, txType model.TransactionType) error {
	account, err := s.accountRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"id": accountID},
	})
	if err != nil {
		return err
	}
	if account == nil {
		return fmt.Errorf("account not found: %s", accountID)
	}

	// Reverse: INCOME was added, so subtract; EXPENSE was subtracted, so add
	switch txType {
	case model.TransactionTypeIncome:
		account.Balance -= amount
	case model.TransactionTypeExpense:
		account.Balance += amount
	}

	return s.accountRepo.Update(ctx, account)
}
