package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockAccountRepository is a mock implementation of AccountRepository
type MockAccountRepository struct {
	mock.Mock
}

func (m *MockAccountRepository) Create(ctx context.Context, account *model.Account) error {
	args := m.Called(ctx, account)
	return args.Error(0)
}

func (m *MockAccountRepository) FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Account, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Account), args.Error(1)
}

func (m *MockAccountRepository) FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Account, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]*model.Account), args.Error(1)
}

func (m *MockAccountRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	args := m.Called(ctx, where)
	return args.Int(0), args.Error(1)
}

func (m *MockAccountRepository) Update(ctx context.Context, account *model.Account) error {
	args := m.Called(ctx, account)
	return args.Error(0)
}

func (m *MockAccountRepository) GetTypeAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error) {
	args := m.Called(ctx, where)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]util.AggregationResult), args.Error(1)
}

func (m *MockAccountRepository) GetCurrencyAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error) {
	args := m.Called(ctx, where)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]util.AggregationResult), args.Error(1)
}

func TestAccountService_CreateAccount(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputAccount := &model.Account{
		ID:       uuid.New(),
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	mockRepo.On("Create", ctx, mock.AnythingOfType("*model.Account")).Return(nil)

	account, err := service.CreateAccount(ctx, inputAccount)

	assert.NoError(t, err)
	assert.NotNil(t, account)
	assert.Equal(t, inputAccount.Name, account.Name)
	assert.Equal(t, inputAccount.Type, account.Type)
	assert.Equal(t, inputAccount.Balance, account.Balance)
	assert.Equal(t, inputAccount.UserID, account.UserID)
	assert.Equal(t, inputAccount.Currency, account.Currency)
	assert.Equal(t, inputAccount.ID, account.ID)

	mockRepo.AssertExpectations(t)
}

func TestAccountService_CreateAccount_InvalidType(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputAccount := &model.Account{
		ID:       uuid.New(),
		Name:     "Test Account",
		Type:     "INVALID_TYPE",
		Balance:  1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	account, err := service.CreateAccount(ctx, inputAccount)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Equal(t, ErrInvalidAccountType, err)

	mockRepo.AssertExpectations(t)
}

func TestAccountService_GetAccount(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	expectedAccount := &model.Account{
		ID:       accountID,
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(expectedAccount, nil)

	account, err := service.GetAccount(ctx, accountID, userID)

	assert.NoError(t, err)
	assert.NotNil(t, account)
	assert.Equal(t, expectedAccount, account)

	mockRepo.AssertExpectations(t)
}

func TestAccountService_GetAccount_NotFound(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, nil)

	account, err := service.GetAccount(ctx, accountID, userID)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Equal(t, ErrAccountNotFound, err)

	mockRepo.AssertExpectations(t)
}

func TestAccountService_GetAccount_AccessDenied(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	differentUserID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": differentUserID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, nil)

	account, err := service.GetAccount(ctx, accountID, differentUserID)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Equal(t, ErrAccountNotFound, err)

	mockRepo.AssertExpectations(t)
}

func TestAccountService_UpdateAccount(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	existingAccount := &model.Account{
		ID:       accountID,
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	newName := "Updated Account"
	newBalance := 1500.0

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingAccount, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Account")).Return(nil)

	account, err := service.UpdateAccount(ctx, accountID, &newName, nil, nil, &newBalance, nil, userID)

	assert.NoError(t, err)
	assert.NotNil(t, account)
	assert.Equal(t, newName, account.Name)
	assert.Equal(t, newBalance, account.Balance)

	mockRepo.AssertExpectations(t)
}

func TestAccountService_UpdateAccount_NotFound(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, nil)

	newName := "Updated Account"
	account, err := service.UpdateAccount(ctx, accountID, &newName, nil, nil, nil, nil, userID)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Equal(t, ErrAccountNotFound, err)

	mockRepo.AssertExpectations(t)
}

func TestAccountService_UpdateAccount_AllFields(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	existingAccount := &model.Account{
		ID:       accountID,
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		Currency: "USD",
		UserID:   userID,
		Notes:    nil,
	}

	newName := "Updated Account"
	newBalance := 1500.0
	newCurrency := "EUR"
	newNotes := "Updated notes"
	isDeleted := true

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingAccount, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Account")).Return(nil)

	account, err := service.UpdateAccount(ctx, accountID, &newName, &newCurrency, &newNotes, &newBalance, &isDeleted, userID)

	assert.NoError(t, err)
	assert.NotNil(t, account)
	assert.Equal(t, newName, account.Name)
	assert.Equal(t, newBalance, account.Balance)
	assert.Equal(t, newCurrency, account.Currency)
	assert.Equal(t, &newNotes, account.Notes)
	assert.True(t, account.IsDeleted)

	mockRepo.AssertExpectations(t)
}

func TestAccountService_GetAccounts(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	expectedAccounts := []*model.Account{
		{
			ID:       uuid.New(),
			Name:     "Account 1",
			Type:     model.AccountTypeBank,
			Balance:  1000.0,
			Currency: "USD",
			UserID:   userID,
		},
		{
			ID:       uuid.New(),
			Name:     "Account 2",
			Type:     model.AccountTypeCash,
			Balance:  500.0,
			Currency: "EUR",
			UserID:   userID,
		},
	}

	typeAggregations := map[string]util.AggregationResult{
		"BANK": {Count: 1, Sum: 1000.0, Avg: 1000.0, Min: 1000.0, Max: 1000.0},
		"CASH": {Count: 1, Sum: 500.0, Avg: 500.0, Min: 500.0, Max: 500.0},
	}

	currencyAggregations := map[string]util.AggregationResult{
		"USD": {Count: 1, Sum: 1000.0, Avg: 1000.0, Min: 1000.0, Max: 1000.0},
		"EUR": {Count: 1, Sum: 500.0, Avg: 500.0, Min: 500.0, Max: 500.0},
	}

	params := GetAccountsParams{
		UserID: userID,
		Page:   1,
		Limit:  10,
	}

	expectedWhereClause := map[string]any{
		"user_id": userID,
	}

	expectedRepoParams := util.FindManyParams{
		Offset:  0,
		Limit:   10,
		Where:   expectedWhereClause,
		OrderBy: "created_at DESC",
	}

	mockRepo.On("GetTypeAggregations", ctx, expectedWhereClause).Return(typeAggregations, nil)
	mockRepo.On("GetCurrencyAggregations", ctx, expectedWhereClause).Return(currencyAggregations, nil)
	mockRepo.On("Count", ctx, expectedWhereClause).Return(2, nil)
	mockRepo.On("FindMany", ctx, expectedRepoParams).Return(expectedAccounts, nil)

	result, err := service.GetAccounts(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, expectedAccounts, result.Accounts)
	assert.Equal(t, 2, result.Total)
	assert.Equal(t, typeAggregations, result.TypeAggregations)
	assert.Equal(t, currencyAggregations, result.CurrencyAggregations)

	mockRepo.AssertExpectations(t)
}

func TestAccountService_GetAccounts_WithFilters(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetAccountsParams{
		UserID:     userID,
		Page:       2,
		Limit:      5,
		Types:      []string{"BANK", "CASH"},
		Currencies: []string{"USD"},
		Search:     "test",
		OrderBy:    "name ASC",
	}

	expectedWhereClause := map[string]any{
		"user_id":  userID,
		"type":     []string{"BANK", "CASH"},
		"currency": []string{"USD"},
		"search":   "test",
	}

	typeAggregationWhere := map[string]any{
		"user_id":  userID,
		"currency": []string{"USD"},
	}

	currencyAggregationWhere := map[string]any{
		"user_id": userID,
		"type":    []string{"BANK", "CASH"},
	}

	expectedRepoParams := util.FindManyParams{
		Offset:  5, // (page 2 - 1) * limit 5
		Limit:   5,
		Where:   expectedWhereClause,
		OrderBy: "name ASC",
	}

	mockRepo.On("GetTypeAggregations", ctx, typeAggregationWhere).Return(map[string]util.AggregationResult{}, nil)
	mockRepo.On("GetCurrencyAggregations", ctx, currencyAggregationWhere).Return(map[string]util.AggregationResult{}, nil)
	mockRepo.On("Count", ctx, expectedWhereClause).Return(10, nil)
	mockRepo.On("FindMany", ctx, expectedRepoParams).Return([]*model.Account{}, nil)

	result, err := service.GetAccounts(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 10, result.Total)

	mockRepo.AssertExpectations(t)
}

func TestAccountService_GetAccounts_DefaultPagination(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetAccountsParams{
		UserID: userID,
		Page:   0, // Should default to 1
		Limit:  0, // Should default to 10
	}

	expectedWhereClause := map[string]any{
		"user_id": userID,
	}

	expectedRepoParams := util.FindManyParams{
		Offset:  0, // (1 - 1) * 10
		Limit:   10,
		Where:   expectedWhereClause,
		OrderBy: "created_at DESC",
	}

	mockRepo.On("GetTypeAggregations", ctx, expectedWhereClause).Return(map[string]util.AggregationResult{}, nil)
	mockRepo.On("GetCurrencyAggregations", ctx, expectedWhereClause).Return(map[string]util.AggregationResult{}, nil)
	mockRepo.On("Count", ctx, expectedWhereClause).Return(0, nil)
	mockRepo.On("FindMany", ctx, expectedRepoParams).Return([]*model.Account{}, nil)

	result, err := service.GetAccounts(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)

	mockRepo.AssertExpectations(t)
}

func TestIsValidAccountType(t *testing.T) {
	tests := []struct {
		name        string
		accountType model.AccountType
		expected    bool
	}{
		{"Valid Bank Type", model.AccountTypeBank, true},
		{"Valid EWallet Type", model.AccountTypeEWallet, true},
		{"Valid Cash Type", model.AccountTypeCash, true},
		{"Valid Credit Card Type", model.AccountTypeCreditCard, true},
		{"Valid Pay Later Type", model.AccountTypePaylater, true},
		{"Invalid Type", "INVALID", false},
		{"Empty Type", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidAccountType(tt.accountType)
			assert.Equal(t, tt.expected, result)
		})
	}
}
func TestAccountService_CreateAccount_RepositoryError(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputAccount := &model.Account{
		ID:       uuid.New(),
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	mockRepo.On("Create", ctx, mock.AnythingOfType("*model.Account")).Return(fmt.Errorf("database error"))

	account, err := service.CreateAccount(ctx, inputAccount)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Contains(t, err.Error(), "failed to create account")

	mockRepo.AssertExpectations(t)
}

func TestAccountService_GetAccount_RepositoryError(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, fmt.Errorf("database error"))

	account, err := service.GetAccount(ctx, accountID, userID)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Contains(t, err.Error(), "failed to get account")

	mockRepo.AssertExpectations(t)
}

func TestAccountService_UpdateAccount_RepositoryError(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	existingAccount := &model.Account{
		ID:       accountID,
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	newName := "Updated Account"

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingAccount, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Account")).Return(fmt.Errorf("database error"))

	account, err := service.UpdateAccount(ctx, accountID, &newName, nil, nil, nil, nil, userID)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Contains(t, err.Error(), "failed to update account")

	mockRepo.AssertExpectations(t)
}

func TestAccountService_GetAccounts_TypeAggregationError(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetAccountsParams{
		UserID: userID,
		Page:   1,
		Limit:  10,
	}

	expectedWhereClause := map[string]any{
		"user_id": userID,
	}

	mockRepo.On("GetTypeAggregations", ctx, expectedWhereClause).Return(nil, fmt.Errorf("aggregation error"))

	result, err := service.GetAccounts(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to get account type aggregations")

	mockRepo.AssertExpectations(t)
}

func TestAccountService_GetAccounts_CurrencyAggregationError(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetAccountsParams{
		UserID: userID,
		Page:   1,
		Limit:  10,
	}

	expectedWhereClause := map[string]any{
		"user_id": userID,
	}

	typeAggregations := map[string]util.AggregationResult{
		"BANK": {Count: 1, Sum: 1000.0},
	}

	mockRepo.On("GetTypeAggregations", ctx, expectedWhereClause).Return(typeAggregations, nil)
	mockRepo.On("GetCurrencyAggregations", ctx, expectedWhereClause).Return(nil, fmt.Errorf("currency aggregation error"))

	result, err := service.GetAccounts(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to get account currency aggregations")

	mockRepo.AssertExpectations(t)
}

func TestAccountService_GetAccounts_CountError(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetAccountsParams{
		UserID: userID,
		Page:   1,
		Limit:  10,
	}

	expectedWhereClause := map[string]any{
		"user_id": userID,
	}

	typeAggregations := map[string]util.AggregationResult{
		"BANK": {Count: 1, Sum: 1000.0},
	}

	currencyAggregations := map[string]util.AggregationResult{
		"USD": {Count: 1, Sum: 1000.0},
	}

	mockRepo.On("GetTypeAggregations", ctx, expectedWhereClause).Return(typeAggregations, nil)
	mockRepo.On("GetCurrencyAggregations", ctx, expectedWhereClause).Return(currencyAggregations, nil)
	mockRepo.On("Count", ctx, expectedWhereClause).Return(0, fmt.Errorf("count error"))

	result, err := service.GetAccounts(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to count user accounts")

	mockRepo.AssertExpectations(t)
}

func TestAccountService_GetAccounts_FindManyError(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetAccountsParams{
		UserID: userID,
		Page:   1,
		Limit:  10,
	}

	expectedWhereClause := map[string]any{
		"user_id": userID,
	}

	expectedRepoParams := util.FindManyParams{
		Offset:  0,
		Limit:   10,
		Where:   expectedWhereClause,
		OrderBy: "created_at DESC",
	}

	typeAggregations := map[string]util.AggregationResult{
		"BANK": {Count: 1, Sum: 1000.0},
	}

	currencyAggregations := map[string]util.AggregationResult{
		"USD": {Count: 1, Sum: 1000.0},
	}

	mockRepo.On("GetTypeAggregations", ctx, expectedWhereClause).Return(typeAggregations, nil)
	mockRepo.On("GetCurrencyAggregations", ctx, expectedWhereClause).Return(currencyAggregations, nil)
	mockRepo.On("Count", ctx, expectedWhereClause).Return(5, nil)
	mockRepo.On("FindMany", ctx, expectedRepoParams).Return(([]*model.Account)(nil), fmt.Errorf("find many error"))

	result, err := service.GetAccounts(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to get user accounts")

	mockRepo.AssertExpectations(t)
}

func TestAccountService_UpdateAccount_FindUniqueError(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, fmt.Errorf("database error"))

	newName := "Updated Account"
	account, err := service.UpdateAccount(ctx, accountID, &newName, nil, nil, nil, nil, userID)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Contains(t, err.Error(), "failed to get account")

	mockRepo.AssertExpectations(t)
}

func TestAccountService_UpdateAccount_IsDeletedFalse(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	existingAccount := &model.Account{
		ID:        accountID,
		Name:      "Test Account",
		Type:      model.AccountTypeBank,
		Balance:   1000.0,
		Currency:  "USD",
		UserID:    userID,
		IsDeleted: false,
	}

	isDeleted := false // Test the case where IsDeleted is false

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingAccount, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Account")).Return(nil)

	account, err := service.UpdateAccount(ctx, accountID, nil, nil, nil, nil, &isDeleted, userID)

	assert.NoError(t, err)
	assert.NotNil(t, account)
	assert.False(t, account.IsDeleted) // Should remain false

	mockRepo.AssertExpectations(t)
}
