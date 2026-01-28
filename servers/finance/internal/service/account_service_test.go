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

const (
	testAccountName      = "Test Account"
	updatedAccountName   = "Updated Account"
	createdAtDescOrder   = "created_at DESC"
	databaseErrorMsg     = "database error"
	mockModelAccountType = "*model.Account"
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
	return parseAggregationArgs(args)
}

func (m *MockAccountRepository) GetCurrencyAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error) {
	args := m.Called(ctx, where)
	return parseAggregationArgs(args)
}

func parseAggregationArgs(args mock.Arguments) (map[string]util.AggregationResult, error) {
	value := args.Get(0)
	if value == nil {
		return nil, args.Error(1)
	}
	return value.(map[string]util.AggregationResult), args.Error(1)
}

func TestAccountServiceCreateAccount(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputAccount := &model.Account{
		Name:     testAccountName,
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	mockRepo.On("Create", ctx, mock.AnythingOfType(mockModelAccountType)).Return(nil)

	account, err := service.CreateAccount(ctx, inputAccount)

	assert.NoError(t, err)
	assert.NotNil(t, account)
	assert.Equal(t, inputAccount.Name, account.Name)
	assert.Equal(t, inputAccount.Type, account.Type)
	assert.Equal(t, inputAccount.Balance, account.Balance)
	assert.Equal(t, inputAccount.UserID, account.UserID)
	assert.Equal(t, inputAccount.Currency, account.Currency)

	mockRepo.AssertExpectations(t)
}

func TestAccountServiceCreateAccountInvalidType(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputAccount := &model.Account{
		Name:     testAccountName,
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

func TestAccountServiceGetAccount(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	expectedAccount := &model.Account{
		ID:       accountID,
		Name:     testAccountName,
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

func TestAccountServiceGetAccountNotFound(t *testing.T) {
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

func TestAccountServiceGetAccountAccessDenied(t *testing.T) {
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

func TestAccountServiceUpdateAccount(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	existingAccount := &model.Account{
		ID:       accountID,
		Name:     testAccountName,
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	newName := updatedAccountName
	newBalance := 1500.0

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingAccount, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType(mockModelAccountType)).Return(nil)

	account, err := service.UpdateAccount(ctx, accountID, UpdateAccountInput{
		Name:    &newName,
		Balance: &newBalance,
	}, userID)

	assert.NoError(t, err)
	assert.NotNil(t, account)
	assert.Equal(t, newName, account.Name)
	assert.Equal(t, newBalance, account.Balance)

	mockRepo.AssertExpectations(t)
}

func TestAccountServiceUpdateAccountNotFound(t *testing.T) {
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

	newName := updatedAccountName
	account, err := service.UpdateAccount(ctx, accountID, UpdateAccountInput{
		Name: &newName,
	}, userID)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Equal(t, ErrAccountNotFound, err)

	mockRepo.AssertExpectations(t)
}

func TestAccountServiceUpdateAccountAllFields(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	existingAccount := &model.Account{
		ID:       accountID,
		Name:     testAccountName,
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		Currency: "USD",
		UserID:   userID,
		Notes:    nil,
	}

	newName := updatedAccountName
	newBalance := 1500.0
	newCurrency := "EUR"
	newNotes := "Updated notes"
	deletedAt := time.Now()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingAccount, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType(mockModelAccountType)).Return(nil)

	account, err := service.UpdateAccount(ctx, accountID, UpdateAccountInput{
		Name:      &newName,
		Currency:  &newCurrency,
		Notes:     &newNotes,
		Balance:   &newBalance,
		DeletedAt: &deletedAt,
	}, userID)

	assert.NoError(t, err)
	assert.NotNil(t, account)
	assert.Equal(t, newName, account.Name)
	assert.Equal(t, newBalance, account.Balance)
	assert.Equal(t, newCurrency, account.Currency)
	assert.Equal(t, &newNotes, account.Notes)
	assert.Equal(t, &deletedAt, account.DeletedAt)

	mockRepo.AssertExpectations(t)
}

func TestAccountServiceGetAccounts(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	expectedAccounts := []*model.Account{
		{
			Name:     "Account 1",
			Type:     model.AccountTypeBank,
			Balance:  1000.0,
			Currency: "USD",
			UserID:   userID,
		},
		{
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
		OrderBy: createdAtDescOrder,
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

func TestAccountServiceGetAccountsWithFilters(t *testing.T) {
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

func TestAccountServiceGetAccountsDefaultPagination(t *testing.T) {
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
		OrderBy: createdAtDescOrder,
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

func TestAccountServiceCreateAccountRepositoryError(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputAccount := &model.Account{
		Name:     testAccountName,
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	mockRepo.On("Create", ctx, mock.AnythingOfType(mockModelAccountType)).Return(fmt.Errorf(databaseErrorMsg))

	account, err := service.CreateAccount(ctx, inputAccount)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Contains(t, err.Error(), "failed to create account")

	mockRepo.AssertExpectations(t)
}

func TestAccountServiceGetAccountRepositoryError(t *testing.T) {
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

	mockRepo.On("FindUnique", ctx, params).Return(nil, fmt.Errorf(databaseErrorMsg))

	account, err := service.GetAccount(ctx, accountID, userID)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Contains(t, err.Error(), "failed to get account")

	mockRepo.AssertExpectations(t)
}

func TestAccountServiceUpdateAccountRepositoryError(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	existingAccount := &model.Account{
		ID:       accountID,
		Name:     testAccountName,
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	newName := updatedAccountName

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      accountID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingAccount, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType(mockModelAccountType)).Return(fmt.Errorf(databaseErrorMsg))

	account, err := service.UpdateAccount(ctx, accountID, UpdateAccountInput{
		Name: &newName,
	}, userID)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Contains(t, err.Error(), "failed to update account")

	mockRepo.AssertExpectations(t)
}

func TestAccountServiceGetAccountsTypeAggregationError(t *testing.T) {
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

func TestAccountServiceGetAccountsCurrencyAggregationError(t *testing.T) {
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

func TestAccountServiceGetAccountsCountError(t *testing.T) {
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

func TestAccountServiceGetAccountsFindManyError(t *testing.T) {
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
		OrderBy: createdAtDescOrder,
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

func TestAccountServiceUpdateAccountFindUniqueError(t *testing.T) {
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

	mockRepo.On("FindUnique", ctx, params).Return(nil, fmt.Errorf(databaseErrorMsg))

	newName := updatedAccountName
	account, err := service.UpdateAccount(ctx, accountID, UpdateAccountInput{
		Name: &newName,
	}, userID)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Contains(t, err.Error(), "failed to get account")

	mockRepo.AssertExpectations(t)
}

func TestAccountServiceUpdateAccountDeletedAtNil(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	existingAccount := &model.Account{
		ID:       accountID,
		Name:     testAccountName,
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

	mockRepo.On("FindUnique", ctx, params).Return(existingAccount, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType(mockModelAccountType)).Return(nil)

	account, err := service.UpdateAccount(ctx, accountID, UpdateAccountInput{}, userID)

	assert.NoError(t, err)
	assert.NotNil(t, account)
	assert.Nil(t, account.DeletedAt) // Should remain nil when not provided

	mockRepo.AssertExpectations(t)
}

func TestAccountServiceDeleteAccountSuccess(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	existing := &model.Account{ID: accountID, UserID: userID}

	params := util.FindUniqueParams{Where: map[string]any{"id": accountID, "user_id": userID}}

	mockRepo.On("FindUnique", ctx, params).Return(existing, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType(mockModelAccountType)).Return(nil)

	err := service.DeleteAccount(ctx, accountID, userID)

	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestAccountServiceDeleteAccountNotFound(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{Where: map[string]any{"id": accountID, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return((*model.Account)(nil), nil)

	err := service.DeleteAccount(ctx, accountID, userID)

	assert.ErrorIs(t, err, ErrAccountNotFound)
	mockRepo.AssertExpectations(t)
}

func TestAccountServiceDeleteAccountFindUniqueError(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{Where: map[string]any{"id": accountID, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return((*model.Account)(nil), fmt.Errorf("db down"))

	err := service.DeleteAccount(ctx, accountID, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get account")
	mockRepo.AssertExpectations(t)
}

func TestAccountServiceDeleteAccountUpdateError(t *testing.T) {
	mockRepo := new(MockAccountRepository)
	service := NewAccountService(mockRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	existing := &model.Account{ID: accountID, UserID: userID}

	params := util.FindUniqueParams{Where: map[string]any{"id": accountID, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return(existing, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType(mockModelAccountType)).Return(fmt.Errorf("update failed"))

	err := service.DeleteAccount(ctx, accountID, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to delete account")
	mockRepo.AssertExpectations(t)
}
