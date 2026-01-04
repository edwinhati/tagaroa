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

type MockBudgetRepository struct {
	mock.Mock
}

func (m *MockBudgetRepository) Create(ctx context.Context, budget *model.Budget) error {
	args := m.Called(ctx, budget)
	return args.Error(0)
}

func (m *MockBudgetRepository) Update(ctx context.Context, budget *model.Budget) error {
	args := m.Called(ctx, budget)
	return args.Error(0)
}

func (m *MockBudgetRepository) FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Budget, error) {
	args := m.Called(ctx, params)
	var budgets []*model.Budget
	if v := args.Get(0); v != nil {
		budgets = v.([]*model.Budget)
	}
	return budgets, args.Error(1)
}

func (m *MockBudgetRepository) FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Budget, error) {
	args := m.Called(ctx, params)
	var budget *model.Budget
	if v := args.Get(0); v != nil {
		budget = v.(*model.Budget)
	}
	return budget, args.Error(1)
}

func (m *MockBudgetRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	args := m.Called(ctx, where)
	return args.Int(0), args.Error(1)
}

func (m *MockBudgetRepository) CreateItem(ctx context.Context, item *model.BudgetItem) error {
	args := m.Called(ctx, item)
	return args.Error(0)
}

func (m *MockBudgetRepository) UpdateItem(ctx context.Context, item *model.BudgetItem) error {
	args := m.Called(ctx, item)
	return args.Error(0)
}

func (m *MockBudgetRepository) GetBudgetItemSpent(ctx context.Context, budgetItemID uuid.UUID) (float64, error) {
	args := m.Called(ctx, budgetItemID)
	return args.Get(0).(float64), args.Error(1)
}

func (m *MockBudgetRepository) GetBudgetItemsSpent(ctx context.Context, budgetItemIDs []uuid.UUID) (map[uuid.UUID]float64, error) {
	args := m.Called(ctx, budgetItemIDs)
	var result map[uuid.UUID]float64
	if v := args.Get(0); v != nil {
		result = v.(map[uuid.UUID]float64)
	}
	return result, args.Error(1)
}

func float64Ptr(v float64) *float64 {
	return &v
}

func TestBudgetServiceCreateBudget(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budgetID := uuid.New()
	inputBudget := &model.Budget{
		ID:       budgetID,
		Month:    int(time.Now().Month()),
		Year:     int(time.Now().Year()),
		Amount:   1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	mockRepo.On("Create", ctx, mock.AnythingOfType("*model.Budget")).Return(nil)
	mockRepo.On("CreateItem", ctx, mock.AnythingOfType("*model.BudgetItem")).Return(nil).Times(len(model.BudgetCategories()))

	budget, err := service.CreateBudget(ctx, inputBudget)

	assert.NoError(t, err)
	assert.NotNil(t, budget)
	assert.Equal(t, inputBudget.Month, budget.Month)
	assert.Equal(t, inputBudget.Year, budget.Year)
	assert.Equal(t, inputBudget.Amount, budget.Amount)
	assert.Equal(t, inputBudget.UserID, budget.UserID)
	assert.Equal(t, inputBudget.Currency, budget.Currency)

	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceCreateBudgetRepositoryError(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budgetID := uuid.New()
	inputBudget := &model.Budget{
		ID:       budgetID,
		Month:    int(time.Now().Month()),
		Year:     int(time.Now().Year()),
		Amount:   1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	mockRepo.On("Create", ctx, mock.AnythingOfType("*model.Budget")).Return(fmt.Errorf("database error"))

	budget, err := service.CreateBudget(ctx, inputBudget)

	assert.Error(t, err)
	assert.Nil(t, budget)
	assert.Contains(t, err.Error(), "failed to create budget")

	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceCreateBudgetItem(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	budgetID := uuid.New()
	item := &model.BudgetItem{
		ID:         uuid.New(),
		Allocation: 123.45,
		BudgetID:   &budgetID,
		Category:   "Housing",
	}

	mockRepo.On("CreateItem", ctx, item).Return(nil)

	result, err := service.CreateBudgetItem(ctx, item)

	assert.NoError(t, err)
	assert.Equal(t, item, result)
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceCreateBudgetItemRepositoryError(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	budgetId := uuid.New()
	item := &model.BudgetItem{
		ID:         uuid.New(),
		Allocation: 200,
		BudgetID:   &budgetId,
		Category:   "Food",
	}

	mockRepo.On("CreateItem", ctx, item).Return(fmt.Errorf("db down"))

	result, err := service.CreateBudgetItem(ctx, item)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to create budget item")
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceCreateBudgetItemCreationError(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputBudget := &model.Budget{
		ID:       uuid.New(),
		Month:    1,
		Year:     2024,
		Amount:   500,
		UserID:   userID,
		Currency: "USD",
	}

	mockRepo.On("Create", ctx, mock.AnythingOfType("*model.Budget")).Return(nil)
	mockRepo.On("CreateItem", ctx, mock.AnythingOfType("*model.BudgetItem")).Return(fmt.Errorf("item err"))

	budget, err := service.CreateBudget(ctx, inputBudget)

	assert.Error(t, err)
	assert.Nil(t, budget)
	assert.Contains(t, err.Error(), "failed to create budget item")
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceUpdateBudget(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budgetID := uuid.New()
	existing := &model.Budget{ID: budgetID, UserID: userID, Amount: 100}

	params := util.FindUniqueParams{Where: map[string]any{"id": budgetID, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return(existing, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Budget")).Return(nil)

	month := 2
	year := 2026
	currency := "EUR"
	input := UpdateBudgetInput{
		Amount:   float64Ptr(200),
		Month:    &month,
		Year:     &year,
		Currency: &currency,
	}
	updated, err := service.UpdateBudget(ctx, budgetID, input, userID)

	assert.NoError(t, err)
	assert.Equal(t, 200.0, updated.Amount)
	assert.Equal(t, month, updated.Month)
	assert.Equal(t, year, updated.Year)
	assert.Equal(t, currency, updated.Currency)
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceUpdateBudgetNotFound(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budgetID := uuid.New()
	params := util.FindUniqueParams{Where: map[string]any{"id": budgetID, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return((*model.Budget)(nil), nil)

	_, err := service.UpdateBudget(ctx, budgetID, UpdateBudgetInput{}, userID)

	assert.ErrorIs(t, err, ErrBudgetNotFound)
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceUpdateBudgetFindUniqueError(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budgetID := uuid.New()
	params := util.FindUniqueParams{Where: map[string]any{"id": budgetID, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return((*model.Budget)(nil), fmt.Errorf("db error"))

	_, err := service.UpdateBudget(ctx, budgetID, UpdateBudgetInput{}, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get budget")
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceUpdateBudgetUpdateError(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budgetID := uuid.New()
	existing := &model.Budget{ID: budgetID, UserID: userID}
	params := util.FindUniqueParams{Where: map[string]any{"id": budgetID, "user_id": userID}}

	mockRepo.On("FindUnique", ctx, params).Return(existing, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Budget")).Return(fmt.Errorf("update failed"))

	_, err := service.UpdateBudget(ctx, budgetID, UpdateBudgetInput{}, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to update budget")
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceGetBudget(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budget := &model.Budget{ID: uuid.New(), UserID: userID}
	params := util.FindUniqueParams{Where: map[string]any{"month": 1, "year": 2024, "user_id": userID}}

	mockRepo.On("FindUnique", ctx, params).Return(budget, nil)

	res, err := service.GetBudget(ctx, 1, 2024, userID)

	assert.NoError(t, err)
	assert.Equal(t, budget, res)
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceGetBudgetNotFound(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	params := util.FindUniqueParams{Where: map[string]any{"month": 1, "year": 2024, "user_id": userID}}

	mockRepo.On("FindUnique", ctx, params).Return((*model.Budget)(nil), nil)

	_, err := service.GetBudget(ctx, 1, 2024, userID)

	assert.ErrorIs(t, err, ErrBudgetNotFound)
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceGetBudgetError(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	params := util.FindUniqueParams{Where: map[string]any{"month": 1, "year": 2024, "user_id": userID}}

	mockRepo.On("FindUnique", ctx, params).Return((*model.Budget)(nil), fmt.Errorf("db fail"))

	_, err := service.GetBudget(ctx, 1, 2024, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get budget")
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceGetBudgets(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	t.Run("with explicit pagination", func(t *testing.T) {
		params := GetBudgetsParams{UserID: userID, Page: 2, Limit: 5}
		where := map[string]any{"user_id": userID}
		findParams := util.FindManyParams{Offset: 5, Limit: 5, Where: where}
		budgets := []*model.Budget{{ID: uuid.New(), UserID: userID}}

		mockRepo.On("Count", ctx, where).Return(10, nil).Once()
		mockRepo.On("FindMany", ctx, findParams).Return(budgets, nil).Once()

		result, err := service.GetBudgets(ctx, params)

		assert.NoError(t, err)
		assert.Equal(t, budgets, result.Budgets)
		assert.Equal(t, 10, result.Total)
		mockRepo.AssertExpectations(t)
	})

	t.Run("defaults pagination when values too low", func(t *testing.T) {
		mockRepo.ExpectedCalls = nil
		mockRepo.Calls = nil

		params := GetBudgetsParams{UserID: userID, Page: 0, Limit: 0}
		where := map[string]any{"user_id": userID}
		findParams := util.FindManyParams{Offset: 0, Limit: 10, Where: where}

		mockRepo.On("Count", ctx, where).Return(0, nil).Once()
		mockRepo.On("FindMany", ctx, findParams).Return([]*model.Budget{}, nil).Once()

		result, err := service.GetBudgets(ctx, params)

		assert.NoError(t, err)
		assert.Empty(t, result.Budgets)
		assert.Equal(t, 0, result.Total)
		mockRepo.AssertExpectations(t)
	})
}

func TestBudgetServiceGetBudgetsCountError(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	params := GetBudgetsParams{UserID: userID, Page: 1, Limit: 5}
	where := map[string]any{"user_id": userID}

	mockRepo.On("Count", ctx, where).Return(0, fmt.Errorf("count err"))

	_, err := service.GetBudgets(ctx, params)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to count user budgets")
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceGetBudgetsFindManyError(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	params := GetBudgetsParams{UserID: userID, Page: 1, Limit: 5}
	where := map[string]any{"user_id": userID}
	findParams := util.FindManyParams{Offset: 0, Limit: 5, Where: where}

	mockRepo.On("Count", ctx, where).Return(1, nil)
	mockRepo.On("FindMany", ctx, findParams).Return(nil, fmt.Errorf("find err"))

	_, err := service.GetBudgets(ctx, params)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get budgets")
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceUpdateBudgetItem(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budgetID := uuid.New()
	item := &model.BudgetItem{ID: uuid.New(), BudgetID: &budgetID, Allocation: 10}
	params := util.FindUniqueParams{Where: map[string]any{"id": budgetID, "user_id": userID}}

	mockRepo.On("FindUnique", ctx, params).Return(&model.Budget{ID: budgetID, UserID: userID}, nil)
	mockRepo.On("UpdateItem", ctx, item).Return(nil)

	updated, err := service.UpdateBudgetItem(ctx, item, userID)

	assert.NoError(t, err)
	assert.Equal(t, item, updated)
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceUpdateBudgetItemMissingBudgetID(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	item := &model.BudgetItem{ID: uuid.New(), Allocation: 10}

	_, err := service.UpdateBudgetItem(ctx, item, uuid.New())

	assert.ErrorIs(t, err, ErrBudgetNotFound)
}

func TestBudgetServiceUpdateBudgetItemFindUniqueError(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budgetID := uuid.New()
	item := &model.BudgetItem{ID: uuid.New(), BudgetID: &budgetID, Allocation: 10}
	params := util.FindUniqueParams{Where: map[string]any{"id": budgetID, "user_id": userID}}

	mockRepo.On("FindUnique", ctx, params).Return((*model.Budget)(nil), fmt.Errorf("db fail"))

	_, err := service.UpdateBudgetItem(ctx, item, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to verify budget ownership")
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceUpdateBudgetItemAccessDenied(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budgetID := uuid.New()
	item := &model.BudgetItem{ID: uuid.New(), BudgetID: &budgetID, Allocation: 10}
	params := util.FindUniqueParams{Where: map[string]any{"id": budgetID, "user_id": userID}}

	mockRepo.On("FindUnique", ctx, params).Return((*model.Budget)(nil), nil)

	_, err := service.UpdateBudgetItem(ctx, item, userID)

	assert.ErrorIs(t, err, ErrBudgetAccessDenied)
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceUpdateBudgetItemUpdateError(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budgetID := uuid.New()
	item := &model.BudgetItem{ID: uuid.New(), BudgetID: &budgetID, Allocation: 10}
	params := util.FindUniqueParams{Where: map[string]any{"id": budgetID, "user_id": userID}}

	mockRepo.On("FindUnique", ctx, params).Return(&model.Budget{ID: budgetID, UserID: userID}, nil)
	mockRepo.On("UpdateItem", ctx, item).Return(fmt.Errorf("update err"))

	_, err := service.UpdateBudgetItem(ctx, item, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to update budget item")
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceGetBudgetWithSpentAmounts(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budgetID := uuid.New()
	budgetItemID1 := uuid.New()
	budgetItemID2 := uuid.New()

	budget := &model.Budget{
		ID:     budgetID,
		UserID: userID,
		Month:  1,
		Year:   2024,
		BudgetItems: []model.BudgetItem{
			{ID: budgetItemID1, Category: "Food", Allocation: 500},
			{ID: budgetItemID2, Category: "Transport", Allocation: 200},
		},
	}

	spentMap := map[uuid.UUID]float64{
		budgetItemID1: 150.0,
		budgetItemID2: 50.0,
	}

	params := util.FindUniqueParams{Where: map[string]any{"month": 1, "year": 2024, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return(budget, nil)
	mockRepo.On("GetBudgetItemsSpent", ctx, []uuid.UUID{budgetItemID1, budgetItemID2}).Return(spentMap, nil)

	res, err := service.GetBudget(ctx, 1, 2024, userID)

	assert.NoError(t, err)
	assert.NotNil(t, res)
	assert.Equal(t, 150.0, res.BudgetItems[0].Spent)
	assert.Equal(t, 50.0, res.BudgetItems[1].Spent)
	mockRepo.AssertExpectations(t)
}

func TestBudgetServiceGetBudgetSpentError(t *testing.T) {
	mockRepo := new(MockBudgetRepository)
	service := NewBudgetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	budgetID := uuid.New()
	budgetItemID := uuid.New()

	budget := &model.Budget{
		ID:     budgetID,
		UserID: userID,
		Month:  1,
		Year:   2024,
		BudgetItems: []model.BudgetItem{
			{ID: budgetItemID, Category: "Food", Allocation: 500},
		},
	}

	params := util.FindUniqueParams{Where: map[string]any{"month": 1, "year": 2024, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return(budget, nil)
	mockRepo.On("GetBudgetItemsSpent", ctx, []uuid.UUID{budgetItemID}).Return((map[uuid.UUID]float64)(nil), fmt.Errorf("db error"))

	res, err := service.GetBudget(ctx, 1, 2024, userID)

	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "failed to get budget items spent")
	mockRepo.AssertExpectations(t)
}
