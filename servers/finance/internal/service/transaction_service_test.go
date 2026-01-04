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

type MockTransactionRepository struct {
	mock.Mock
}

func (m *MockTransactionRepository) Create(ctx context.Context, transaction *model.Transaction) error {
	args := m.Called(ctx, transaction)
	return args.Error(0)
}

func (m *MockTransactionRepository) FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Transaction, error) {
	args := m.Called(ctx, params)
	var transaction *model.Transaction
	if v := args.Get(0); v != nil {
		transaction = v.(*model.Transaction)
	}
	return transaction, args.Error(1)
}

func (m *MockTransactionRepository) FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Transaction, error) {
	args := m.Called(ctx, params)
	var transactions []*model.Transaction
	if v := args.Get(0); v != nil {
		transactions = v.([]*model.Transaction)
	}
	return transactions, args.Error(1)
}

func (m *MockTransactionRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	args := m.Called(ctx, where)
	return args.Int(0), args.Error(1)
}

func (m *MockTransactionRepository) Update(ctx context.Context, transaction *model.Transaction) error {
	args := m.Called(ctx, transaction)
	return args.Error(0)
}

func (m *MockTransactionRepository) GetTypeAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error) {
	args := m.Called(ctx, where)
	var result map[string]util.AggregationResult
	if v := args.Get(0); v != nil {
		result = v.(map[string]util.AggregationResult)
	}
	return result, args.Error(1)
}

func (m *MockTransactionRepository) GetCurrencyAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error) {
	args := m.Called(ctx, where)
	var result map[string]util.AggregationResult
	if v := args.Get(0); v != nil {
		result = v.(map[string]util.AggregationResult)
	}
	return result, args.Error(1)
}

func (m *MockTransactionRepository) GetAccountAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error) {
	args := m.Called(ctx, where)
	var result map[string]util.AggregationResult
	if v := args.Get(0); v != nil {
		result = v.(map[string]util.AggregationResult)
	}
	return result, args.Error(1)
}

func (m *MockTransactionRepository) GetCategoryAggregations(ctx context.Context, where map[string]any) (map[string]util.AggregationResult, error) {
	args := m.Called(ctx, where)
	var result map[string]util.AggregationResult
	if v := args.Get(0); v != nil {
		result = v.(map[string]util.AggregationResult)
	}
	return result, args.Error(1)
}

func TestNewTransactionService(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)

	service := NewTransactionService(mockTxRepo, mockAccRepo)

	assert.NotNil(t, service)
}

func TestTransactionServiceCreateTransaction(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	transaction := &model.Transaction{
		ID:        uuid.New(),
		Amount:    100.0,
		Date:      time.Now(),
		Type:      model.TransactionTypeExpense,
		Currency:  "USD",
		UserID:    userID,
		AccountID: accountID,
	}

	account := &model.Account{
		ID:      accountID,
		Balance: 1000.0,
	}

	mockTxRepo.On("Create", ctx, transaction).Return(nil)
	mockAccRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(account, nil)
	mockAccRepo.On("Update", ctx, mock.AnythingOfType("*model.Account")).Return(nil)

	result, err := service.CreateTransaction(ctx, transaction)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	mockTxRepo.AssertExpectations(t)
	mockAccRepo.AssertExpectations(t)
}

func TestTransactionServiceCreateTransactionInvalidType(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transaction := &model.Transaction{
		ID:        uuid.New(),
		Amount:    100.0,
		Date:      time.Now(),
		Type:      "INVALID_TYPE",
		Currency:  "USD",
		UserID:    uuid.New(),
		AccountID: uuid.New(),
	}

	result, err := service.CreateTransaction(ctx, transaction)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrInvalidTransactionType)
}

func TestTransactionServiceCreateTransactionRepoError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transaction := &model.Transaction{
		ID:        uuid.New(),
		Amount:    100.0,
		Date:      time.Now(),
		Type:      model.TransactionTypeExpense,
		Currency:  "USD",
		UserID:    uuid.New(),
		AccountID: uuid.New(),
	}

	mockTxRepo.On("Create", ctx, transaction).Return(fmt.Errorf("db error"))

	result, err := service.CreateTransaction(ctx, transaction)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to create transaction")
	mockTxRepo.AssertExpectations(t)
}

func TestTransactionServiceCreateTransactionAccountUpdateError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	accountID := uuid.New()
	transaction := &model.Transaction{
		ID:        uuid.New(),
		Amount:    100.0,
		Date:      time.Now(),
		Type:      model.TransactionTypeExpense,
		Currency:  "USD",
		UserID:    uuid.New(),
		AccountID: accountID,
	}

	mockTxRepo.On("Create", ctx, transaction).Return(nil)
	mockAccRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return((*model.Account)(nil), fmt.Errorf("account not found"))

	result, err := service.CreateTransaction(ctx, transaction)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to update account balance")
	mockTxRepo.AssertExpectations(t)
}

func TestTransactionServiceGetTransaction(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	transaction := &model.Transaction{
		ID:     transactionID,
		UserID: userID,
	}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(transaction, nil)

	result, err := service.GetTransaction(ctx, transactionID, userID)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, transactionID, result.ID)
	mockTxRepo.AssertExpectations(t)
}

func TestTransactionServiceGetTransactionNotFound(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return((*model.Transaction)(nil), nil)

	result, err := service.GetTransaction(ctx, transactionID, userID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrTransactionNotFound)
	mockTxRepo.AssertExpectations(t)
}

func TestTransactionServiceGetTransactionError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return((*model.Transaction)(nil), fmt.Errorf("db error"))

	result, err := service.GetTransaction(ctx, transactionID, userID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to get transaction")
	mockTxRepo.AssertExpectations(t)
}

func TestTransactionServiceGetTransactions(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	userID := uuid.New()
	params := GetTransactionsParams{
		UserID: userID,
		Page:   1,
		Limit:  10,
	}

	transactions := []*model.Transaction{{ID: uuid.New()}}
	typeAggs := map[string]util.AggregationResult{"EXPENSE": {Count: 1}}
	currencyAggs := map[string]util.AggregationResult{"USD": {Count: 1}}
	accountAggs := map[string]util.AggregationResult{"Bank": {Count: 1}}
	categoryAggs := map[string]util.AggregationResult{"Food": {Count: 1}}

	mockTxRepo.On("GetTypeAggregations", ctx, mock.Anything).Return(typeAggs, nil)
	mockTxRepo.On("GetCurrencyAggregations", ctx, mock.Anything).Return(currencyAggs, nil)
	mockTxRepo.On("GetAccountAggregations", ctx, mock.Anything).Return(accountAggs, nil)
	mockTxRepo.On("GetCategoryAggregations", ctx, mock.Anything).Return(categoryAggs, nil)
	mockTxRepo.On("Count", ctx, mock.Anything).Return(1, nil)
	mockTxRepo.On("FindMany", ctx, mock.AnythingOfType("util.FindManyParams")).Return(transactions, nil)

	result, err := service.GetTransactions(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Len(t, result.Transactions, 1)
	assert.Equal(t, 1, result.Total)
	mockTxRepo.AssertExpectations(t)
}

func TestTransactionServiceGetTransactionsDefaultPagination(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	userID := uuid.New()
	params := GetTransactionsParams{
		UserID: userID,
		Page:   0, // Should default to 1
		Limit:  0, // Should default to 10
	}

	mockTxRepo.On("GetTypeAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetCurrencyAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetAccountAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetCategoryAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("Count", ctx, mock.Anything).Return(0, nil)
	mockTxRepo.On("FindMany", ctx, mock.AnythingOfType("util.FindManyParams")).Return([]*model.Transaction{}, nil)

	result, err := service.GetTransactions(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	mockTxRepo.AssertExpectations(t)
}

func TestTransactionServiceGetTransactionsWithFilters(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	userID := uuid.New()
	startDate := time.Now().AddDate(0, -1, 0)
	endDate := time.Now()
	params := GetTransactionsParams{
		UserID:     userID,
		Page:       1,
		Limit:      10,
		Types:      []string{"EXPENSE"},
		Currencies: []string{"USD"},
		Accounts:   []string{"Bank"},
		Categories: []string{"Food"},
		StartDate:  &startDate,
		EndDate:    &endDate,
	}

	mockTxRepo.On("GetTypeAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetCurrencyAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetAccountAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetCategoryAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("Count", ctx, mock.Anything).Return(0, nil)
	mockTxRepo.On("FindMany", ctx, mock.AnythingOfType("util.FindManyParams")).Return([]*model.Transaction{}, nil)

	result, err := service.GetTransactions(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	mockTxRepo.AssertExpectations(t)
}

func TestTransactionServiceGetTransactionsTypeAggError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	params := GetTransactionsParams{UserID: uuid.New(), Page: 1, Limit: 10}

	mockTxRepo.On("GetTypeAggregations", ctx, mock.Anything).Return((map[string]util.AggregationResult)(nil), fmt.Errorf("db error"))

	result, err := service.GetTransactions(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to get transaction type aggregations")
}

func TestTransactionServiceGetTransactionsCurrencyAggError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	params := GetTransactionsParams{UserID: uuid.New(), Page: 1, Limit: 10}

	mockTxRepo.On("GetTypeAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetCurrencyAggregations", ctx, mock.Anything).Return((map[string]util.AggregationResult)(nil), fmt.Errorf("db error"))

	result, err := service.GetTransactions(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to get transaction currency aggregations")
}

func TestTransactionServiceGetTransactionsAccountAggError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	params := GetTransactionsParams{UserID: uuid.New(), Page: 1, Limit: 10}

	mockTxRepo.On("GetTypeAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetCurrencyAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetAccountAggregations", ctx, mock.Anything).Return((map[string]util.AggregationResult)(nil), fmt.Errorf("db error"))

	result, err := service.GetTransactions(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to get transaction account aggregations")
}

func TestTransactionServiceGetTransactionsCategoryAggError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	params := GetTransactionsParams{UserID: uuid.New(), Page: 1, Limit: 10}

	mockTxRepo.On("GetTypeAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetCurrencyAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetAccountAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetCategoryAggregations", ctx, mock.Anything).Return((map[string]util.AggregationResult)(nil), fmt.Errorf("db error"))

	result, err := service.GetTransactions(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to get transaction category aggregations")
}

func TestTransactionServiceGetTransactionsCountError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	params := GetTransactionsParams{UserID: uuid.New(), Page: 1, Limit: 10}

	mockTxRepo.On("GetTypeAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetCurrencyAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetAccountAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetCategoryAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("Count", ctx, mock.Anything).Return(0, fmt.Errorf("db error"))

	result, err := service.GetTransactions(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to count user transactions")
}

func TestTransactionServiceGetTransactionsFindManyError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	params := GetTransactionsParams{UserID: uuid.New(), Page: 1, Limit: 10}

	mockTxRepo.On("GetTypeAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetCurrencyAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetAccountAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("GetCategoryAggregations", ctx, mock.Anything).Return(map[string]util.AggregationResult{}, nil)
	mockTxRepo.On("Count", ctx, mock.Anything).Return(1, nil)
	mockTxRepo.On("FindMany", ctx, mock.AnythingOfType("util.FindManyParams")).Return(([]*model.Transaction)(nil), fmt.Errorf("db error"))

	result, err := service.GetTransactions(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to get user transactions")
}

func TestTransactionServiceUpdateTransaction(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeExpense,
		UserID:    userID,
		AccountID: accountID,
	}
	account := &model.Account{ID: accountID, Balance: 1000.0}

	newAmount := 200.0
	input := UpdateTransactionInput{
		Amount: &newAmount,
	}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*model.Transaction")).Return(nil)
	mockAccRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(account, nil)
	mockAccRepo.On("Update", ctx, mock.AnythingOfType("*model.Account")).Return(nil)

	result, err := service.UpdateTransaction(ctx, transactionID, input, userID)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 200.0, result.Amount)
	mockTxRepo.AssertExpectations(t)
}

func TestTransactionServiceUpdateTransactionNotFound(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	input := UpdateTransactionInput{}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return((*model.Transaction)(nil), nil)

	result, err := service.UpdateTransaction(ctx, transactionID, input, userID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrTransactionNotFound)
}

func TestTransactionServiceUpdateTransactionFindError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	input := UpdateTransactionInput{}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return((*model.Transaction)(nil), fmt.Errorf("db error"))

	result, err := service.UpdateTransaction(ctx, transactionID, input, userID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to get transaction")
}

func TestTransactionServiceUpdateTransactionUpdateError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeExpense,
		UserID:    userID,
		AccountID: accountID,
	}
	input := UpdateTransactionInput{}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*model.Transaction")).Return(fmt.Errorf("db error"))

	result, err := service.UpdateTransaction(ctx, transactionID, input, userID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to update transaction")
}

func TestTransactionServiceUpdateTransactionAllFields(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	newAccountID := uuid.New()
	budgetItemID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeExpense,
		UserID:    userID,
		AccountID: accountID,
		Date:      time.Now(),
		Currency:  "USD",
	}
	account := &model.Account{ID: accountID, Balance: 1000.0}
	newAccount := &model.Account{ID: newAccountID, Balance: 2000.0}

	newAmount := 200.0
	newDate := time.Now().AddDate(0, 0, 1)
	newType := model.TransactionTypeIncome
	newCurrency := "EUR"
	newNotes := "Updated notes"
	newAccountIDStr := newAccountID.String()
	newBudgetItemIDStr := budgetItemID.String()

	input := UpdateTransactionInput{
		Amount:       &newAmount,
		Date:         &newDate,
		Type:         &newType,
		Currency:     &newCurrency,
		Notes:        &newNotes,
		Files:        []string{"file1.jpg"},
		AccountID:    &newAccountIDStr,
		BudgetItemID: &newBudgetItemIDStr,
	}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*model.Transaction")).Return(nil)
	// Reverse old balance
	mockAccRepo.On("FindUnique", ctx, mock.MatchedBy(func(p util.FindUniqueParams) bool {
		return p.Where["id"] == accountID
	})).Return(account, nil)
	mockAccRepo.On("Update", ctx, mock.MatchedBy(func(a *model.Account) bool {
		return a.ID == accountID
	})).Return(nil)
	// Apply new balance
	mockAccRepo.On("FindUnique", ctx, mock.MatchedBy(func(p util.FindUniqueParams) bool {
		return p.Where["id"] == newAccountID
	})).Return(newAccount, nil)
	mockAccRepo.On("Update", ctx, mock.MatchedBy(func(a *model.Account) bool {
		return a.ID == newAccountID
	})).Return(nil)

	result, err := service.UpdateTransaction(ctx, transactionID, input, userID)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, newAmount, result.Amount)
	assert.Equal(t, newType, result.Type)
	assert.Equal(t, newCurrency, result.Currency)
	assert.Equal(t, &newNotes, result.Notes)
	mockTxRepo.AssertExpectations(t)
}

func TestTransactionServiceUpdateTransactionEmptyAccountID(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeExpense,
		UserID:    userID,
		AccountID: uuid.New(),
	}

	emptyAccountID := ""
	input := UpdateTransactionInput{
		AccountID: &emptyAccountID,
	}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)

	result, err := service.UpdateTransaction(ctx, transactionID, input, userID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "account_id cannot be empty")
}

func TestTransactionServiceUpdateTransactionInvalidAccountID(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeExpense,
		UserID:    userID,
		AccountID: uuid.New(),
	}

	invalidAccountID := "not-a-uuid"
	input := UpdateTransactionInput{
		AccountID: &invalidAccountID,
	}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)

	result, err := service.UpdateTransaction(ctx, transactionID, input, userID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "invalid account_id format")
}

func TestTransactionServiceUpdateTransactionEmptyBudgetItemID(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	budgetItemID := uuid.New()
	existingTx := &model.Transaction{
		ID:           transactionID,
		Amount:       100.0,
		Type:         model.TransactionTypeExpense,
		UserID:       userID,
		AccountID:    accountID,
		BudgetItemID: &budgetItemID,
	}

	emptyBudgetItemID := ""
	input := UpdateTransactionInput{
		BudgetItemID: &emptyBudgetItemID,
	}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*model.Transaction")).Return(nil)

	result, err := service.UpdateTransaction(ctx, transactionID, input, userID)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Nil(t, result.BudgetItemID) // Should be cleared
}

func TestTransactionServiceUpdateTransactionInvalidBudgetItemID(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeExpense,
		UserID:    userID,
		AccountID: uuid.New(),
	}

	invalidBudgetItemID := "not-a-uuid"
	input := UpdateTransactionInput{
		BudgetItemID: &invalidBudgetItemID,
	}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)

	result, err := service.UpdateTransaction(ctx, transactionID, input, userID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "invalid budget_item_id format")
}

func TestTransactionServiceUpdateTransactionReverseBalanceError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeExpense,
		UserID:    userID,
		AccountID: accountID,
	}

	newAmount := 200.0
	input := UpdateTransactionInput{
		Amount: &newAmount,
	}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*model.Transaction")).Return(nil)
	mockAccRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return((*model.Account)(nil), fmt.Errorf("account not found"))

	result, err := service.UpdateTransaction(ctx, transactionID, input, userID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to reverse old account balance")
}

func TestTransactionServiceDeleteTransaction(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeExpense,
		UserID:    userID,
		AccountID: accountID,
	}
	account := &model.Account{ID: accountID, Balance: 900.0}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*model.Transaction")).Return(nil)
	mockAccRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(account, nil)
	mockAccRepo.On("Update", ctx, mock.AnythingOfType("*model.Account")).Return(nil)

	err := service.DeleteTransaction(ctx, transactionID, userID)

	assert.NoError(t, err)
	mockTxRepo.AssertExpectations(t)
}

func TestTransactionServiceDeleteTransactionNotFound(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return((*model.Transaction)(nil), nil)

	err := service.DeleteTransaction(ctx, transactionID, userID)

	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrTransactionNotFound)
}

func TestTransactionServiceDeleteTransactionFindError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return((*model.Transaction)(nil), fmt.Errorf("db error"))

	err := service.DeleteTransaction(ctx, transactionID, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get transaction")
}

func TestTransactionServiceDeleteTransactionUpdateError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeExpense,
		UserID:    userID,
		AccountID: uuid.New(),
	}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*model.Transaction")).Return(fmt.Errorf("db error"))

	err := service.DeleteTransaction(ctx, transactionID, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to delete transaction")
}

func TestTransactionServiceDeleteTransactionReverseBalanceError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeExpense,
		UserID:    userID,
		AccountID: accountID,
	}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*model.Transaction")).Return(nil)
	mockAccRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return((*model.Account)(nil), fmt.Errorf("account not found"))

	err := service.DeleteTransaction(ctx, transactionID, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to reverse account balance")
}

func TestTransactionServiceCreateTransactionIncome(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	accountID := uuid.New()
	transaction := &model.Transaction{
		ID:        uuid.New(),
		Amount:    500.0,
		Date:      time.Now(),
		Type:      model.TransactionTypeIncome,
		Currency:  "USD",
		UserID:    uuid.New(),
		AccountID: accountID,
	}

	account := &model.Account{ID: accountID, Balance: 1000.0}

	mockTxRepo.On("Create", ctx, transaction).Return(nil)
	mockAccRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(account, nil)
	mockAccRepo.On("Update", ctx, mock.MatchedBy(func(a *model.Account) bool {
		return a.Balance == 1500.0 // 1000 + 500
	})).Return(nil)

	result, err := service.CreateTransaction(ctx, transaction)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	mockTxRepo.AssertExpectations(t)
	mockAccRepo.AssertExpectations(t)
}

func TestTransactionServiceUpdateAccountBalanceAccountNotFound(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	accountID := uuid.New()
	transaction := &model.Transaction{
		ID:        uuid.New(),
		Amount:    100.0,
		Date:      time.Now(),
		Type:      model.TransactionTypeExpense,
		Currency:  "USD",
		UserID:    uuid.New(),
		AccountID: accountID,
	}

	mockTxRepo.On("Create", ctx, transaction).Return(nil)
	mockAccRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return((*model.Account)(nil), nil)

	result, err := service.CreateTransaction(ctx, transaction)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "account not found")
}

func TestIsValidTransactionType(t *testing.T) {
	assert.True(t, isValidTransactionType(model.TransactionTypeIncome))
	assert.True(t, isValidTransactionType(model.TransactionTypeExpense))
	assert.False(t, isValidTransactionType("INVALID"))
}

func TestTransactionServiceDeleteIncomeTransaction(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    500.0,
		Type:      model.TransactionTypeIncome, // Income transaction
		UserID:    userID,
		AccountID: accountID,
	}
	account := &model.Account{ID: accountID, Balance: 1500.0}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*model.Transaction")).Return(nil)
	mockAccRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(account, nil)
	mockAccRepo.On("Update", ctx, mock.MatchedBy(func(a *model.Account) bool {
		return a.Balance == 1000.0 // 1500 - 500 (reverse income)
	})).Return(nil)

	err := service.DeleteTransaction(ctx, transactionID, userID)

	assert.NoError(t, err)
	mockTxRepo.AssertExpectations(t)
	mockAccRepo.AssertExpectations(t)
}

func TestTransactionServiceUpdateTransactionNewBalanceError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	newAccountID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeExpense,
		UserID:    userID,
		AccountID: accountID,
	}
	account := &model.Account{ID: accountID, Balance: 1000.0}

	newAmount := 200.0
	newAccountIDStr := newAccountID.String()
	input := UpdateTransactionInput{
		Amount:    &newAmount,
		AccountID: &newAccountIDStr,
	}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*model.Transaction")).Return(nil)
	// Reverse old balance succeeds
	mockAccRepo.On("FindUnique", ctx, mock.MatchedBy(func(p util.FindUniqueParams) bool {
		return p.Where["id"] == accountID
	})).Return(account, nil)
	mockAccRepo.On("Update", ctx, mock.MatchedBy(func(a *model.Account) bool {
		return a.ID == accountID
	})).Return(nil)
	// Apply new balance fails
	mockAccRepo.On("FindUnique", ctx, mock.MatchedBy(func(p util.FindUniqueParams) bool {
		return p.Where["id"] == newAccountID
	})).Return((*model.Account)(nil), fmt.Errorf("new account not found"))

	result, err := service.UpdateTransaction(ctx, transactionID, input, userID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to update new account balance")
}

func TestTransactionServiceReverseAccountBalanceUpdateError(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeIncome,
		UserID:    userID,
		AccountID: accountID,
	}
	account := &model.Account{ID: accountID, Balance: 1100.0}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*model.Transaction")).Return(nil)
	mockAccRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(account, nil)
	mockAccRepo.On("Update", ctx, mock.AnythingOfType("*model.Account")).Return(fmt.Errorf("update failed"))

	err := service.DeleteTransaction(ctx, transactionID, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to reverse account balance")
}

func TestTransactionServiceReverseAccountBalanceAccountNotFound(t *testing.T) {
	mockTxRepo := new(MockTransactionRepository)
	mockAccRepo := new(MockAccountRepository)
	service := NewTransactionService(mockTxRepo, mockAccRepo)

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	existingTx := &model.Transaction{
		ID:        transactionID,
		Amount:    100.0,
		Type:      model.TransactionTypeIncome,
		UserID:    userID,
		AccountID: accountID,
	}

	mockTxRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return(existingTx, nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*model.Transaction")).Return(nil)
	// Account not found - returns nil, nil
	mockAccRepo.On("FindUnique", ctx, mock.AnythingOfType("util.FindUniqueParams")).Return((*model.Account)(nil), nil)

	err := service.DeleteTransaction(ctx, transactionID, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "account not found")
}
