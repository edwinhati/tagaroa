package service

import (
	"context"
	"errors"
	"fmt"
	"slices"
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
	ErrAccountAccessDenied  = errors.New("access denied")
	ErrAccountNotFound      = errors.New("account not found")
	ErrAccountInvalidAmount = errors.New("invalid amount")
	ErrInvalidAccountType   = errors.New("invalid account type")
)

type GetAccountsParams struct {
	UserID     uuid.UUID
	Page       int
	Limit      int
	Types      []string
	Currencies []string
	Search     string
	OrderBy    string
}

type GetAccountsResult struct {
	Accounts             []*model.Account
	Total                int
	TypeAggregations     map[string]util.AggregationResult
	CurrencyAggregations map[string]util.AggregationResult
}

type UpdateAccountInput struct {
	Name      *string
	Currency  *string
	Notes     *string
	Balance   *float64
	DeletedAt *time.Time
}

type AccountService interface {
	CreateAccount(ctx context.Context, account *model.Account) (*model.Account, error)
	GetAccount(ctx context.Context, id, userID uuid.UUID) (*model.Account, error)
	GetAccounts(ctx context.Context, params GetAccountsParams) (*GetAccountsResult, error)
	UpdateAccount(ctx context.Context, id uuid.UUID, input UpdateAccountInput, userID uuid.UUID) (*model.Account, error)
	DeleteAccount(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}

type accountService struct {
	accountRepo    repository.AccountRepository
	log            *zap.SugaredLogger
	eventPublisher event.EventPublisher
}

func NewAccountService(accountRepo repository.AccountRepository) AccountService {
	return &accountService{
		accountRepo:    accountRepo,
		log:            logger.New().With("service", "account"),
		eventPublisher: nil,
	}
}

func NewAccountServiceWithEvents(accountRepo repository.AccountRepository, eventPublisher event.EventPublisher) AccountService {
	return &accountService{
		accountRepo:    accountRepo,
		log:            logger.New().With("service", "account"),
		eventPublisher: eventPublisher,
	}
}

func (s *accountService) CreateAccount(ctx context.Context, account *model.Account) (*model.Account, error) {
	if !isValidAccountType(account.Type) {
		s.log.Warnw("Invalid account type", "type", account.Type)
		return nil, ErrInvalidAccountType
	}

	if err := s.accountRepo.Create(ctx, account); err != nil {
		s.log.Errorw("Failed to create account", "error", err, "user_id", account.UserID, "type", account.Type)
		return nil, fmt.Errorf("failed to create account: %w", err)
	}

	s.log.Infow("Account created", "account_id", account.ID, "user_id", account.UserID, "type", account.Type)
	return account, nil
}

func (s *accountService) GetAccount(ctx context.Context, id, userID uuid.UUID) (*model.Account, error) {
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      id,
			"user_id": userID,
		},
	}

	account, err := s.accountRepo.FindUnique(ctx, params)
	if err != nil {
		s.log.Errorw("Failed to get account", "error", err, "account_id", id, "user_id", userID)
		return nil, fmt.Errorf("failed to get account: %w", err)
	}
	if account == nil {
		s.log.Debugw("Account not found", "account_id", id, "user_id", userID)
		return nil, ErrAccountNotFound
	}

	s.log.Debugw("Account found", "account_id", id, "user_id", userID)
	return account, nil
}

func (s *accountService) GetAccounts(ctx context.Context, params GetAccountsParams) (*GetAccountsResult, error) {
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

	if len(params.Types) > 0 {
		whereClause["type"] = params.Types
	}

	if len(params.Currencies) > 0 {
		whereClause["currency"] = params.Currencies
	}

	if params.Search != "" {
		whereClause["search"] = params.Search
	}

	typeAggregationWhere := map[string]any{
		"user_id": params.UserID,
	}
	if len(params.Currencies) > 0 {
		typeAggregationWhere["currency"] = params.Currencies
	}
	typeAggregations, err := s.accountRepo.GetTypeAggregations(ctx, typeAggregationWhere)
	if err != nil {
		s.log.Errorw("Failed to get type aggregations", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to get account type aggregations: %w", err)
	}

	currencyAggregationWhere := map[string]any{
		"user_id": params.UserID,
	}
	if len(params.Types) > 0 {
		currencyAggregationWhere["type"] = params.Types
	}
	currencyAggregations, err := s.accountRepo.GetCurrencyAggregations(ctx, currencyAggregationWhere)
	if err != nil {
		s.log.Errorw("Failed to get currency aggregations", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to get account currency aggregations: %w", err)
	}

	total, err := s.accountRepo.Count(ctx, whereClause)
	if err != nil {
		s.log.Errorw("Failed to count accounts", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to count user accounts: %w", err)
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

	accounts, err := s.accountRepo.FindMany(ctx, repoParams)
	if err != nil {
		s.log.Errorw("Failed to get accounts", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to get user accounts: %w", err)
	}

	s.log.Infow("Accounts retrieved", "user_id", params.UserID, "count", len(accounts), "total", total, "page", params.Page)
	return &GetAccountsResult{
		Accounts:             accounts,
		Total:                total,
		TypeAggregations:     typeAggregations,
		CurrencyAggregations: currencyAggregations,
	}, nil
}

func (s *accountService) UpdateAccount(ctx context.Context, id uuid.UUID, input UpdateAccountInput, userID uuid.UUID) (*model.Account, error) {
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      id,
			"user_id": userID,
		},
	}

	account, err := s.accountRepo.FindUnique(ctx, params)
	if err != nil {
		s.log.Errorw("Failed to get account for update", "error", err, "account_id", id, "user_id", userID)
		return nil, fmt.Errorf("failed to get account: %w", err)
	}
	if account == nil {
		s.log.Debugw("Account not found for update", "account_id", id, "user_id", userID)
		return nil, ErrAccountNotFound
	}

	if input.Name != nil {
		account.Name = *input.Name
	}

	oldBalance := account.Balance
	if input.Balance != nil {
		account.Balance = *input.Balance
	}
	if input.Currency != nil {
		account.Currency = *input.Currency
	}
	if input.Notes != nil {
		account.Notes = input.Notes
	}
	if input.DeletedAt != nil {
		account.DeletedAt = input.DeletedAt
	}

	if err := s.accountRepo.Update(ctx, account); err != nil {
		s.log.Errorw("Failed to update account", "error", err, "account_id", id)
		return nil, fmt.Errorf("failed to update account: %w", err)
	}

	// Publish event if balance changed
	if oldBalance != account.Balance && s.eventPublisher != nil {
		balanceEvent := event.NewEvent(event.EventAccountBalanceUpdated, userID.String()).
			WithPayload("account_id", account.ID.String()).
			WithPayload("old_balance", oldBalance).
			WithPayload("new_balance", account.Balance).
			WithPayload("currency", account.Currency).
			Build()

		if err := s.eventPublisher.Publish(ctx, balanceEvent); err != nil {
			s.log.Errorw("Failed to publish account.balance_updated event", "error", err, "account_id", account.ID)
		}
	}

	s.log.Infow("Account updated", "account_id", id, "user_id", userID)
	return account, nil
}

func (s *accountService) DeleteAccount(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      id,
			"user_id": userID,
		},
	}

	account, err := s.accountRepo.FindUnique(ctx, params)
	if err != nil {
		s.log.Errorw("Failed to get account for delete", "error", err, "account_id", id, "user_id", userID)
		return fmt.Errorf("failed to get account: %w", err)
	}
	if account == nil {
		s.log.Debugw("Account not found for delete", "account_id", id, "user_id", userID)
		return ErrAccountNotFound
	}

	now := time.Now()
	account.DeletedAt = &now

	if err := s.accountRepo.Update(ctx, account); err != nil {
		s.log.Errorw("Failed to delete account", "error", err, "account_id", id)
		return fmt.Errorf("failed to delete account: %w", err)
	}

	s.log.Infow("Account deleted", "account_id", id, "user_id", userID)
	return nil
}

func isValidAccountType(accountType model.AccountType) bool {
	validTypes := model.AccountTypes()
	return slices.Contains(validTypes, accountType)
}
