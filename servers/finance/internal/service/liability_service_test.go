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

type MockLiabilityRepository struct {
	mock.Mock
}

func (m *MockLiabilityRepository) Create(ctx context.Context, liability *model.Liability) error {
	args := m.Called(ctx, liability)
	return args.Error(0)
}

func (m *MockLiabilityRepository) FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Liability, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Liability), args.Error(1)
}

func (m *MockLiabilityRepository) FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Liability, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]*model.Liability), args.Error(1)
}

func (m *MockLiabilityRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	args := m.Called(ctx, where)
	return args.Int(0), args.Error(1)
}

func (m *MockLiabilityRepository) Update(ctx context.Context, liability *model.Liability) error {
	args := m.Called(ctx, liability)
	return args.Error(0)
}

func (m *MockLiabilityRepository) SumByUserAndCurrency(ctx context.Context, userID uuid.UUID, currency string) (float64, error) {
	args := m.Called(ctx, userID, currency)
	return args.Get(0).(float64), args.Error(1)
}

func TestLiabilityServiceCreateLiability(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputLiability := &model.Liability{
		Name:     "Test Loan",
		Type:     model.LiabilityTypeLoan,
		Amount:   1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	mockRepo.On("Create", ctx, mock.AnythingOfType("*model.Liability")).Return(nil)

	liability, err := service.CreateLiability(ctx, inputLiability)

	assert.NoError(t, err)
	assert.NotNil(t, liability)
	assert.Equal(t, inputLiability.Name, liability.Name)
	assert.Equal(t, inputLiability.Type, liability.Type)
	assert.Equal(t, inputLiability.Amount, liability.Amount)
	assert.Equal(t, inputLiability.UserID, liability.UserID)
	assert.Equal(t, inputLiability.Currency, liability.Currency)

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceCreateLiabilityInvalidType(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputLiability := &model.Liability{
		Name:     "Invalid Liability",
		Type:     "INVALID_TYPE",
		Amount:   1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	liability, err := service.CreateLiability(ctx, inputLiability)

	assert.Error(t, err)
	assert.Nil(t, liability)
	assert.Equal(t, ErrInvalidLiabilityType, err)

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceCreateLiabilityRepositoryError(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputLiability := &model.Liability{
		Name:     "Test Loan",
		Type:     model.LiabilityTypeLoan,
		Amount:   1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	mockRepo.On("Create", ctx, mock.AnythingOfType("*model.Liability")).Return(fmt.Errorf("database error"))

	liability, err := service.CreateLiability(ctx, inputLiability)

	assert.Error(t, err)
	assert.Nil(t, liability)
	assert.Contains(t, err.Error(), "failed to create liability")

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceGetLiability(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()
	expectedLiability := &model.Liability{
		ID:       liabilityID,
		Name:     "Test Loan",
		Type:     model.LiabilityTypeLoan,
		Amount:   1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      liabilityID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(expectedLiability, nil)

	liability, err := service.GetLiability(ctx, liabilityID, userID)

	assert.NoError(t, err)
	assert.NotNil(t, liability)
	assert.Equal(t, expectedLiability, liability)

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceGetLiabilityNotFound(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      liabilityID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, nil)

	liability, err := service.GetLiability(ctx, liabilityID, userID)

	assert.Error(t, err)
	assert.Nil(t, liability)
	assert.Equal(t, ErrLiabilityNotFound, err)

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceGetLiabilityRepositoryError(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      liabilityID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, fmt.Errorf("database error"))

	liability, err := service.GetLiability(ctx, liabilityID, userID)

	assert.Error(t, err)
	assert.Nil(t, liability)
	assert.Contains(t, err.Error(), "failed to get liability")

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceGetLiabilities(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	expectedLiabilities := []*model.Liability{
		{ID: uuid.New(), Name: "Loan 1", Type: model.LiabilityTypeLoan, Amount: 1000.0, UserID: userID, Currency: "USD"},
		{ID: uuid.New(), Name: "Credit Card", Type: model.LiabilityTypeCreditCard, Amount: 500.0, UserID: userID, Currency: "USD"},
	}

	params := GetLiabilitiesParams{
		UserID: userID,
		Page:   1,
		Limit:  10,
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID}).Return(2, nil)
	mockRepo.On("FindMany", ctx, mock.Anything).Return(expectedLiabilities, nil)

	result, err := service.GetLiabilities(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, expectedLiabilities, result.Liabilities)
	assert.Equal(t, 2, result.Total)

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceGetLiabilitiesDefaultPagination(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetLiabilitiesParams{
		UserID: userID,
		Page:   0,
		Limit:  0,
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID}).Return(0, nil)
	mockRepo.On("FindMany", ctx, mock.Anything).Return([]*model.Liability{}, nil)

	result, err := service.GetLiabilities(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 0, result.Total)

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceGetLiabilitiesCountError(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetLiabilitiesParams{
		UserID: userID,
		Page:   1,
		Limit:  10,
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID}).Return(0, fmt.Errorf("count error"))

	result, err := service.GetLiabilities(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to count liabilities")

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceGetLiabilitiesFindManyError(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetLiabilitiesParams{
		UserID: userID,
		Page:   1,
		Limit:  10,
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID}).Return(5, nil)
	mockRepo.On("FindMany", ctx, mock.Anything).Return([]*model.Liability(nil), fmt.Errorf("find many error"))

	result, err := service.GetLiabilities(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to get liabilities")

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceUpdateLiabilityAllFields(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()
	existingLiability := &model.Liability{
		ID:       liabilityID,
		Name:     "Test Loan",
		Type:     model.LiabilityTypeLoan,
		Amount:   1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	newName := "Updated Loan"
	newAmount := 1500.0
	newCurrency := "EUR"
	newNotes := "Updated notes"
	newType := model.LiabilityTypeMortgage
	paidAt := time.Now()
	deletedAt := time.Now()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      liabilityID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingLiability, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Liability")).Return(nil)

	liability, err := service.UpdateLiability(ctx, liabilityID, UpdateLiabilityInput{
		Name:      &newName,
		Type:      &newType,
		Amount:    &newAmount,
		Currency:  &newCurrency,
		Notes:     &newNotes,
		PaidAt:    &paidAt,
		DeletedAt: &deletedAt,
	}, userID)

	assert.NoError(t, err)
	assert.NotNil(t, liability)
	assert.Equal(t, newName, liability.Name)
	assert.Equal(t, newType, liability.Type)
	assert.Equal(t, newAmount, liability.Amount)
	assert.Equal(t, newCurrency, liability.Currency)
	assert.Equal(t, &newNotes, liability.Notes)
	assert.Equal(t, &paidAt, liability.PaidAt)
	assert.Equal(t, &deletedAt, liability.DeletedAt)

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceUpdateLiabilityOnlyAmount(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()
	existingLiability := &model.Liability{
		ID:       liabilityID,
		Name:     "Test Loan",
		Type:     model.LiabilityTypeLoan,
		Amount:   1000.0,
		Currency: "USD",
		UserID:   userID,
		Notes:    nil,
	}

	newAmount := 2000.0

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      liabilityID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingLiability, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Liability")).Return(nil)

	liability, err := service.UpdateLiability(ctx, liabilityID, UpdateLiabilityInput{
		Amount: &newAmount,
	}, userID)

	assert.NoError(t, err)
	assert.NotNil(t, liability)
	assert.Equal(t, newAmount, liability.Amount)
	assert.Nil(t, liability.Notes)

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceGetLiabilitiesWithTypesFilter(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetLiabilitiesParams{
		UserID:     userID,
		Page:       1,
		Limit:      10,
		Types:      []string{"LOAN", "MORTGAGE"},
		Currencies: nil,
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID, "type": []string{"LOAN", "MORTGAGE"}}).Return(5, nil)
	mockRepo.On("FindMany", ctx, mock.Anything).Return([]*model.Liability{}, nil)

	result, err := service.GetLiabilities(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 5, result.Total)
	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceGetLiabilitiesWithCurrenciesFilter(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetLiabilitiesParams{
		UserID:     userID,
		Page:       1,
		Limit:      10,
		Types:      nil,
		Currencies: []string{"USD", "EUR"},
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID, "currency": []string{"USD", "EUR"}}).Return(3, nil)
	mockRepo.On("FindMany", ctx, mock.Anything).Return([]*model.Liability{}, nil)

	result, err := service.GetLiabilities(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 3, result.Total)
	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceGetLiabilitiesWithBothFilters(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetLiabilitiesParams{
		UserID:     userID,
		Page:       1,
		Limit:      10,
		Types:      []string{"LOAN"},
		Currencies: []string{"USD"},
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID, "type": []string{"LOAN"}, "currency": []string{"USD"}}).Return(2, nil)
	mockRepo.On("FindMany", ctx, mock.Anything).Return([]*model.Liability{}, nil)

	result, err := service.GetLiabilities(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 2, result.Total)
	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceUpdateLiabilityNotFound(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      liabilityID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, nil)

	liability, err := service.UpdateLiability(ctx, liabilityID, UpdateLiabilityInput{}, userID)

	assert.Error(t, err)
	assert.Nil(t, liability)
	assert.Equal(t, ErrLiabilityNotFound, err)

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceUpdateLiabilityFindUniqueError(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      liabilityID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, fmt.Errorf("database error"))

	liability, err := service.UpdateLiability(ctx, liabilityID, UpdateLiabilityInput{}, userID)

	assert.Error(t, err)
	assert.Nil(t, liability)
	assert.Contains(t, err.Error(), "failed to get liability")

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceUpdateLiabilityRepositoryError(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()
	existingLiability := &model.Liability{
		ID:       liabilityID,
		Name:     "Test Loan",
		Type:     model.LiabilityTypeLoan,
		Amount:   1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      liabilityID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingLiability, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Liability")).Return(fmt.Errorf("update error"))

	liability, err := service.UpdateLiability(ctx, liabilityID, UpdateLiabilityInput{}, userID)

	assert.Error(t, err)
	assert.Nil(t, liability)
	assert.Contains(t, err.Error(), "failed to update liability")

	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceDeleteLiability(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()
	existing := &model.Liability{ID: liabilityID, UserID: userID}

	params := util.FindUniqueParams{Where: map[string]any{"id": liabilityID, "user_id": userID}}

	mockRepo.On("FindUnique", ctx, params).Return(existing, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Liability")).Return(nil)

	err := service.DeleteLiability(ctx, liabilityID, userID)

	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceDeleteLiabilityNotFound(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{Where: map[string]any{"id": liabilityID, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return((*model.Liability)(nil), nil)

	err := service.DeleteLiability(ctx, liabilityID, userID)

	assert.ErrorIs(t, err, ErrLiabilityNotFound)
	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceDeleteLiabilityFindUniqueError(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{Where: map[string]any{"id": liabilityID, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return((*model.Liability)(nil), fmt.Errorf("db down"))

	err := service.DeleteLiability(ctx, liabilityID, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get liability")
	mockRepo.AssertExpectations(t)
}

func TestLiabilityServiceDeleteLiabilityUpdateError(t *testing.T) {
	mockRepo := new(MockLiabilityRepository)
	service := NewLiabilityService(mockRepo)

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()
	existing := &model.Liability{ID: liabilityID, UserID: userID}

	params := util.FindUniqueParams{Where: map[string]any{"id": liabilityID, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return(existing, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Liability")).Return(fmt.Errorf("update failed"))

	err := service.DeleteLiability(ctx, liabilityID, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "update failed")
	mockRepo.AssertExpectations(t)
}

func TestIsValidLiabilityType(t *testing.T) {
	tests := []struct {
		name          string
		liabilityType model.LiabilityType
		expected      bool
	}{
		{"Valid Mortgage Type", model.LiabilityTypeMortgage, true},
		{"Valid Loan Type", model.LiabilityTypeLoan, true},
		{"Valid CreditCard Type", model.LiabilityTypeCreditCard, true},
		{"Valid Other Type", model.LiabilityTypeOther, true},
		{"Invalid Type", "INVALID", false},
		{"Empty Type", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidLiabilityType(tt.liabilityType)
			assert.Equal(t, tt.expected, result)
		})
	}
}
