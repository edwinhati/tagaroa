package service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/event"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/repository"
	"github.com/google/uuid"
	"go.uber.org/zap"
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
	eventPublisher  event.EventPublisher
	log             *zap.SugaredLogger
}

func NewTransactionService(transactionRepo repository.TransactionRepository, accountRepo repository.AccountRepository) TransactionService {
	return &transactionService{
		transactionRepo: transactionRepo,
		accountRepo:     accountRepo,
		log:             logger.New().With("service", "transaction"),
	}
}

func NewTransactionServiceWithEvents(transactionRepo repository.TransactionRepository, accountRepo repository.AccountRepository, eventPublisher event.EventPublisher) TransactionService {
	return &transactionService{
		transactionRepo: transactionRepo,
		accountRepo:     accountRepo,
		eventPublisher:  eventPublisher,
		log:             logger.New().With("service", "transaction"),
	}
}

func (s *transactionService) CreateTransaction(ctx context.Context, transaction *model.Transaction) (*model.Transaction, error) {
	if !isValidTransactionType(transaction.Type) {
		s.log.Warnw("Invalid transaction type", "type", transaction.Type)
		return nil, ErrInvalidTransactionType
	}

	if err := s.transactionRepo.Create(ctx, transaction); err != nil {
		s.log.Errorw("Failed to create transaction", "error", err, "user_id", transaction.UserID, "amount", transaction.Amount)
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	if err := s.updateAccountBalance(ctx, transaction.AccountID, transaction.Amount, transaction.Type); err != nil {
		s.log.Errorw("Failed to update account balance", "error", err, "account_id", transaction.AccountID)
		return nil, fmt.Errorf("failed to update account balance: %w", err)
	}

	if s.eventPublisher != nil {
		txEvent := event.NewEvent(event.EventTransactionCreated, transaction.UserID.String()).
			WithPayload("transaction_id", transaction.ID.String()).
			WithPayload("amount", transaction.Amount).
			WithPayload("type", string(transaction.Type)).
			WithPayload("account_id", transaction.AccountID.String()).
			Build()
		if err := s.eventPublisher.Publish(ctx, txEvent); err != nil {
			s.log.Errorw("Failed to publish transaction created event", "error", err, "transaction_id", transaction.ID)
		}
	}

	s.log.Infow("Transaction created", "transaction_id", transaction.ID, "user_id", transaction.UserID, "amount", transaction.Amount, "type", transaction.Type)
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
		s.log.Errorw("Failed to get transaction", "error", err, "transaction_id", id, "user_id", userID)
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}
	if transaction == nil {
		s.log.Debugw("Transaction not found", "transaction_id", id, "user_id", userID)
		return nil, ErrTransactionNotFound
	}

	s.log.Debugw("Transaction found", "transaction_id", id)
	return transaction, nil
}

func (s *transactionService) GetTransactions(ctx context.Context, params GetTransactionsParams) (*GetTransactionsResult, error) {
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

	if params.StartDate != nil {
		whereClause["start_date"] = *params.StartDate
	}
	if params.EndDate != nil {
		whereClause["end_date"] = *params.EndDate
	}

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
		s.log.Errorw("Failed to get type aggregations", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to get transaction type aggregations: %w", err)
	}

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
		s.log.Errorw("Failed to get currency aggregations", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to get transaction currency aggregations: %w", err)
	}

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
		s.log.Errorw("Failed to get account aggregations", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to get transaction account aggregations: %w", err)
	}

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
		s.log.Errorw("Failed to get category aggregations", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to get transaction category aggregations: %w", err)
	}

	total, err := s.transactionRepo.Count(ctx, whereClause)
	if err != nil {
		s.log.Errorw("Failed to count transactions", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to count user transactions: %w", err)
	}

	repoParams := util.FindManyParams{
		Offset:  offset,
		Limit:   params.Limit,
		Where:   whereClause,
		OrderBy: params.OrderBy,
	}

	if repoParams.OrderBy == "" {
		repoParams.OrderBy = "created_at DESC"
	}

	transactions, err := s.transactionRepo.FindMany(ctx, repoParams)
	if err != nil {
		s.log.Errorw("Failed to get transactions", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to get user transactions: %w", err)
	}

	s.log.Infow("Transactions retrieved", "user_id", params.UserID, "count", len(transactions), "total", total, "page", params.Page)
	return &GetTransactionsResult{
		Transactions:         transactions,
		Total:                total,
		TypeAggregations:     typeAggregations,
		CurrencyAggregations: currencyAggregations,
		AccountAggregations:  accountAggregations,
		CategoryAggregations: categoryAggregations,
	}, nil
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
		s.log.Errorw("Failed to get transaction for update", "error", err, "transaction_id", id)
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}
	if transaction == nil {
		s.log.Debugw("Transaction not found for update", "transaction_id", id)
		return nil, ErrTransactionNotFound
	}

	oldAmount := transaction.Amount
	oldType := transaction.Type
	oldAccountID := transaction.AccountID

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
		s.log.Errorw("Failed to update transaction", "error", err, "transaction_id", id)
		return nil, fmt.Errorf("failed to update transaction: %w", err)
	}

	if s.eventPublisher != nil {
		txEvent := event.NewEvent(event.EventTransactionUpdated, userID.String()).
			WithPayload("transaction_id", id.String()).
			WithPayload("old_amount", oldAmount).
			WithPayload("new_amount", transaction.Amount).
			WithPayload("type_changed", oldType != transaction.Type).
			Build()
		if err := s.eventPublisher.Publish(ctx, txEvent); err != nil {
			s.log.Errorw("Failed to publish transaction updated event", "error", err, "transaction_id", id)
		}
	}

	if oldAmount != transaction.Amount || oldType != transaction.Type || oldAccountID != transaction.AccountID {
		if err := s.reverseAccountBalance(ctx, oldAccountID, oldAmount, oldType); err != nil {
			s.log.Errorw("Failed to reverse old account balance", "error", err, "account_id", oldAccountID)
			return nil, fmt.Errorf("failed to reverse old account balance: %w", err)
		}
		if err := s.updateAccountBalance(ctx, transaction.AccountID, transaction.Amount, transaction.Type); err != nil {
			s.log.Errorw("Failed to update new account balance", "error", err, "account_id", transaction.AccountID)
			return nil, fmt.Errorf("failed to update new account balance: %w", err)
		}
	}

	s.log.Infow("Transaction updated", "transaction_id", id)
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
		s.log.Errorw("Failed to get transaction for delete", "error", err, "transaction_id", id)
		return fmt.Errorf("failed to get transaction: %w", err)
	}
	if transaction == nil {
		s.log.Debugw("Transaction not found for delete", "transaction_id", id)
		return ErrTransactionNotFound
	}

	now := time.Now()
	transaction.DeletedAt = &now

	if err := s.transactionRepo.Update(ctx, transaction); err != nil {
		s.log.Errorw("Failed to delete transaction", "error", err, "transaction_id", id)
		return fmt.Errorf("failed to delete transaction: %w", err)
	}

	if s.eventPublisher != nil {
		txEvent := event.NewEvent(event.EventTransactionDeleted, userID.String()).
			WithPayload("transaction_id", id.String()).
			WithPayload("amount", transaction.Amount).
			WithPayload("type", string(transaction.Type)).
			Build()
		if err := s.eventPublisher.Publish(ctx, txEvent); err != nil {
			s.log.Errorw("Failed to publish transaction deleted event", "error", err, "transaction_id", id)
		}
	}

	if err := s.reverseAccountBalance(ctx, transaction.AccountID, transaction.Amount, transaction.Type); err != nil {
		s.log.Errorw("Failed to reverse account balance", "error", err, "account_id", transaction.AccountID)
		return fmt.Errorf("failed to reverse account balance: %w", err)
	}

	s.log.Infow("Transaction deleted", "transaction_id", id)
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
		s.log.Errorw("Failed to find account for balance update", "error", err, "account_id", accountID)
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

	if err := s.accountRepo.Update(ctx, account); err != nil {
		s.log.Errorw("Failed to update account balance", "error", err, "account_id", accountID, "new_balance", account.Balance)
		return err
	}

	s.log.Debugw("Account balance updated", "account_id", accountID, "amount", amount, "type", txType, "new_balance", account.Balance)
	return nil
}

// reverseAccountBalance reverses the effect of a transaction on account balance
// Used when updating or deleting transactions
func (s *transactionService) reverseAccountBalance(ctx context.Context, accountID uuid.UUID, amount float64, txType model.TransactionType) error {
	account, err := s.accountRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"id": accountID},
	})
	if err != nil {
		s.log.Errorw("Failed to find account for balance reversal", "error", err, "account_id", accountID)
		return err
	}
	if account == nil {
		return fmt.Errorf("account not found: %s", accountID)
	}

	switch txType {
	case model.TransactionTypeIncome:
		account.Balance -= amount
	case model.TransactionTypeExpense:
		account.Balance += amount
	}

	if err := s.accountRepo.Update(ctx, account); err != nil {
		s.log.Errorw("Failed to reverse account balance", "error", err, "account_id", accountID, "new_balance", account.Balance)
		return err
	}

	s.log.Debugw("Account balance reversed", "account_id", accountID, "amount", amount, "type", txType, "new_balance", account.Balance)
	return nil
}
