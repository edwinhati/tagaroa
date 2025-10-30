package service

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/repository"
	"github.com/google/uuid"
)

// Shared error variables across all services
var (
	ErrAccessDenied       = errors.New("access denied")
	ErrAccountNotFound    = errors.New("account not found")
	ErrInvalidAmount      = errors.New("invalid amount")
	ErrInvalidAccountType = errors.New("invalid account type")
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

type AccountService interface {
	CreateAccount(ctx context.Context, account *model.Account) (*model.Account, error)
	GetAccount(ctx context.Context, id, userID uuid.UUID) (*model.Account, error)
	GetAccounts(ctx context.Context, params GetAccountsParams) (*GetAccountsResult, error)
	UpdateAccount(ctx context.Context, id uuid.UUID, name, currency, notes *string, balance *float64, IsDeleted *bool, userID uuid.UUID) (*model.Account, error)
}

type accountService struct {
	accountRepo repository.AccountRepository
}

func NewAccountService(accountRepo repository.AccountRepository) AccountService {
	return &accountService{
		accountRepo: accountRepo,
	}
}

func (s *accountService) CreateAccount(ctx context.Context, account *model.Account) (*model.Account, error) {
	// Validate account type
	if !isValidAccountType(account.Type) {
		return nil, ErrInvalidAccountType
	}

	if err := s.accountRepo.Create(ctx, account); err != nil {
		return nil, fmt.Errorf("failed to create account: %w", err)
	}

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
		return nil, fmt.Errorf("failed to get account: %w", err)
	}
	if account == nil {
		return nil, ErrAccountNotFound
	}

	return account, nil
}

func (s *accountService) GetAccounts(ctx context.Context, params GetAccountsParams) (*GetAccountsResult, error) {
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

	// Add multi-select filters
	if len(params.Types) > 0 {
		whereClause["type"] = params.Types
	}

	if len(params.Currencies) > 0 {
		whereClause["currency"] = params.Currencies
	}

	// Add search filter if provided
	if params.Search != "" {
		whereClause["search"] = params.Search
	}

	// Get type aggregations (excluding type filter to show all available types)
	typeAggregationWhere := map[string]any{
		"user_id": params.UserID,
	}
	if len(params.Currencies) > 0 {
		typeAggregationWhere["currency"] = params.Currencies
	}
	typeAggregations, err := s.accountRepo.GetTypeAggregations(ctx, typeAggregationWhere)
	if err != nil {
		return nil, fmt.Errorf("failed to get account type aggregations: %w", err)
	}

	// Get currency aggregations (excluding currency filter to show all available currencies)
	currencyAggregationWhere := map[string]any{
		"user_id": params.UserID,
	}
	if len(params.Types) > 0 {
		currencyAggregationWhere["type"] = params.Types
	}
	currencyAggregations, err := s.accountRepo.GetCurrencyAggregations(ctx, currencyAggregationWhere)
	if err != nil {
		return nil, fmt.Errorf("failed to get account currency aggregations: %w", err)
	}

	// Get total count for pagination
	total, err := s.accountRepo.Count(ctx, whereClause)
	if err != nil {
		return nil, fmt.Errorf("failed to count user accounts: %w", err)
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

	accounts, err := s.accountRepo.FindMany(ctx, repoParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get user accounts: %w", err)
	}

	result := &GetAccountsResult{
		Accounts:             accounts,
		Total:                total,
		TypeAggregations:     typeAggregations,
		CurrencyAggregations: currencyAggregations,
	}

	return result, nil
}

func (s *accountService) UpdateAccount(ctx context.Context, id uuid.UUID, name, currency, notes *string, balance *float64, IsDeleted *bool, userID uuid.UUID) (*model.Account, error) {
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      id,
			"user_id": userID,
		},
	}

	account, err := s.accountRepo.FindUnique(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get account: %w", err)
	}
	if account == nil {
		return nil, ErrAccountNotFound
	}

	// Update fields if provided
	if name != nil {
		account.Name = *name
	}
	if balance != nil {
		account.Balance = *balance
	}
	if currency != nil {
		account.Currency = *currency
	}
	if notes != nil {
		account.Notes = notes
	}

	if IsDeleted != nil && *IsDeleted {
		account.IsDeleted = true
	}

	if err := s.accountRepo.Update(ctx, account); err != nil {
		return nil, fmt.Errorf("failed to update account: %w", err)
	}

	return account, nil
}

func isValidAccountType(accountType model.AccountType) bool {
	validTypes := model.AccountTypes()
	return slices.Contains(validTypes, accountType)
}
