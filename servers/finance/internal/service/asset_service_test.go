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

type MockAssetRepository struct {
	mock.Mock
}

func (m *MockAssetRepository) Create(ctx context.Context, asset *model.Asset) error {
	args := m.Called(ctx, asset)
	return args.Error(0)
}

func (m *MockAssetRepository) FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Asset, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockAssetRepository) FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Asset, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]*model.Asset), args.Error(1)
}

func (m *MockAssetRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	args := m.Called(ctx, where)
	return args.Int(0), args.Error(1)
}

func (m *MockAssetRepository) Update(ctx context.Context, asset *model.Asset) error {
	args := m.Called(ctx, asset)
	return args.Error(0)
}

func (m *MockAssetRepository) SumByUserAndCurrency(ctx context.Context, userID uuid.UUID, currency string) (float64, error) {
	args := m.Called(ctx, userID, currency)
	return args.Get(0).(float64), args.Error(1)
}

func TestAssetServiceCreateAsset(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputAsset := &model.Asset{
		Name:     "Test Stock",
		Type:     model.AssetTypeStock,
		Value:    1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	mockRepo.On("Create", ctx, mock.AnythingOfType("*model.Asset")).Return(nil)

	asset, err := service.CreateAsset(ctx, inputAsset)

	assert.NoError(t, err)
	assert.NotNil(t, asset)
	assert.Equal(t, inputAsset.Name, asset.Name)
	assert.Equal(t, inputAsset.Type, asset.Type)
	assert.Equal(t, inputAsset.Value, asset.Value)
	assert.Equal(t, inputAsset.UserID, asset.UserID)
	assert.Equal(t, inputAsset.Currency, asset.Currency)

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceCreateAssetInvalidType(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputAsset := &model.Asset{
		Name:     "Invalid Asset",
		Type:     "INVALID_TYPE",
		Value:    1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	asset, err := service.CreateAsset(ctx, inputAsset)

	assert.Error(t, err)
	assert.Nil(t, asset)
	assert.Equal(t, ErrInvalidAssetType, err)

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceCreateAssetRepositoryError(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()
	inputAsset := &model.Asset{
		Name:     "Test Stock",
		Type:     model.AssetTypeStock,
		Value:    1000.0,
		UserID:   userID,
		Currency: "USD",
	}

	mockRepo.On("Create", ctx, mock.AnythingOfType("*model.Asset")).Return(fmt.Errorf("database error"))

	asset, err := service.CreateAsset(ctx, inputAsset)

	assert.Error(t, err)
	assert.Nil(t, asset)
	assert.Contains(t, err.Error(), "failed to create asset")

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceGetAsset(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()
	expectedAsset := &model.Asset{
		ID:       assetID,
		Name:     "Test Stock",
		Type:     model.AssetTypeStock,
		Value:    1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      assetID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(expectedAsset, nil)

	asset, err := service.GetAsset(ctx, assetID, userID)

	assert.NoError(t, err)
	assert.NotNil(t, asset)
	assert.Equal(t, expectedAsset, asset)

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceGetAssetNotFound(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      assetID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, nil)

	asset, err := service.GetAsset(ctx, assetID, userID)

	assert.Error(t, err)
	assert.Nil(t, asset)
	assert.Equal(t, ErrAssetNotFound, err)

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceGetAssetRepositoryError(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      assetID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, fmt.Errorf("database error"))

	asset, err := service.GetAsset(ctx, assetID, userID)

	assert.Error(t, err)
	assert.Nil(t, asset)
	assert.Contains(t, err.Error(), "failed to get asset")

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceGetAssets(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	expectedAssets := []*model.Asset{
		{ID: uuid.New(), Name: "Stock 1", Type: model.AssetTypeStock, Value: 1000.0, UserID: userID, Currency: "USD"},
		{ID: uuid.New(), Name: "Stock 2", Type: model.AssetTypeStock, Value: 2000.0, UserID: userID, Currency: "USD"},
	}

	params := GetAssetsParams{
		UserID: userID,
		Page:   1,
		Limit:  10,
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID}).Return(2, nil)
	mockRepo.On("FindMany", ctx, mock.Anything).Return(expectedAssets, nil)

	result, err := service.GetAssets(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, expectedAssets, result.Assets)
	assert.Equal(t, 2, result.Total)

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceGetAssetsDefaultPagination(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetAssetsParams{
		UserID: userID,
		Page:   0,
		Limit:  0,
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID}).Return(0, nil)
	mockRepo.On("FindMany", ctx, mock.Anything).Return([]*model.Asset{}, nil)

	result, err := service.GetAssets(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 0, result.Total)

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceGetAssetsCountError(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetAssetsParams{
		UserID: userID,
		Page:   1,
		Limit:  10,
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID}).Return(0, fmt.Errorf("count error"))

	result, err := service.GetAssets(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to count assets")

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceGetAssetsFindManyError(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetAssetsParams{
		UserID: userID,
		Page:   1,
		Limit:  10,
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID}).Return(5, nil)
	mockRepo.On("FindMany", ctx, mock.Anything).Return([]*model.Asset(nil), fmt.Errorf("find many error"))

	result, err := service.GetAssets(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to get assets")

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceUpdateAssetAllFields(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()
	existingAsset := &model.Asset{
		ID:       assetID,
		Name:     "Test Stock",
		Type:     model.AssetTypeStock,
		Value:    1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	newName := "Updated Stock"
	newValue := 1500.0
	newCurrency := "EUR"
	newNotes := "Updated notes"
	newType := model.AssetTypeCrypto
	shares := 100.0
	ticker := "BTC"
	deletedAt := time.Now()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      assetID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingAsset, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Asset")).Return(nil)

	asset, err := service.UpdateAsset(ctx, assetID, UpdateAssetInput{
		Name:      &newName,
		Type:      &newType,
		Value:     &newValue,
		Shares:    &shares,
		Ticker:    &ticker,
		Currency:  &newCurrency,
		Notes:     &newNotes,
		DeletedAt: &deletedAt,
	}, userID)

	assert.NoError(t, err)
	assert.NotNil(t, asset)
	assert.Equal(t, newName, asset.Name)
	assert.Equal(t, newType, asset.Type)
	assert.Equal(t, newValue, asset.Value)
	assert.Equal(t, &shares, asset.Shares)
	assert.Equal(t, &ticker, asset.Ticker)
	assert.Equal(t, newCurrency, asset.Currency)
	assert.Equal(t, &newNotes, asset.Notes)
	assert.Equal(t, &deletedAt, asset.DeletedAt)

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceUpdateAssetOnlyName(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()
	existingAsset := &model.Asset{
		ID:       assetID,
		Name:     "Test Stock",
		Type:     model.AssetTypeStock,
		Value:    1000.0,
		Currency: "USD",
		UserID:   userID,
		Shares:   nil,
		Ticker:   nil,
		Notes:    nil,
	}

	newName := "New Name"

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      assetID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingAsset, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Asset")).Return(nil)

	asset, err := service.UpdateAsset(ctx, assetID, UpdateAssetInput{
		Name: &newName,
	}, userID)

	assert.NoError(t, err)
	assert.NotNil(t, asset)
	assert.Equal(t, newName, asset.Name)
	assert.Nil(t, asset.Shares)
	assert.Nil(t, asset.Ticker)
	assert.Nil(t, asset.Notes)

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceGetAssetsWithTypesFilter(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetAssetsParams{
		UserID:     userID,
		Page:       1,
		Limit:      10,
		Types:      []string{"STOCK", "CRYPTO"},
		Currencies: nil,
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID, "type": []string{"STOCK", "CRYPTO"}}).Return(5, nil)
	mockRepo.On("FindMany", ctx, mock.Anything).Return([]*model.Asset{}, nil)

	result, err := service.GetAssets(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 5, result.Total)
	mockRepo.AssertExpectations(t)
}

func TestAssetServiceGetAssetsWithCurrenciesFilter(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetAssetsParams{
		UserID:     userID,
		Page:       1,
		Limit:      10,
		Types:      nil,
		Currencies: []string{"USD", "EUR"},
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID, "currency": []string{"USD", "EUR"}}).Return(3, nil)
	mockRepo.On("FindMany", ctx, mock.Anything).Return([]*model.Asset{}, nil)

	result, err := service.GetAssets(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 3, result.Total)
	mockRepo.AssertExpectations(t)
}

func TestAssetServiceGetAssetsWithBothFilters(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	userID := uuid.New()

	params := GetAssetsParams{
		UserID:     userID,
		Page:       1,
		Limit:      10,
		Types:      []string{"STOCK"},
		Currencies: []string{"USD"},
	}

	mockRepo.On("Count", ctx, map[string]any{"user_id": userID, "type": []string{"STOCK"}, "currency": []string{"USD"}}).Return(2, nil)
	mockRepo.On("FindMany", ctx, mock.Anything).Return([]*model.Asset{}, nil)

	result, err := service.GetAssets(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 2, result.Total)
	mockRepo.AssertExpectations(t)
}

func TestAssetServiceUpdateAssetNotFound(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      assetID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, nil)

	asset, err := service.UpdateAsset(ctx, assetID, UpdateAssetInput{}, userID)

	assert.Error(t, err)
	assert.Nil(t, asset)
	assert.Equal(t, ErrAssetNotFound, err)

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceUpdateAssetFindUniqueError(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      assetID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(nil, fmt.Errorf("database error"))

	asset, err := service.UpdateAsset(ctx, assetID, UpdateAssetInput{}, userID)

	assert.Error(t, err)
	assert.Nil(t, asset)
	assert.Contains(t, err.Error(), "failed to get asset")

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceUpdateAssetRepositoryError(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()
	existingAsset := &model.Asset{
		ID:       assetID,
		Name:     "Test Stock",
		Type:     model.AssetTypeStock,
		Value:    1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      assetID,
			"user_id": userID,
		},
	}

	mockRepo.On("FindUnique", ctx, params).Return(existingAsset, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Asset")).Return(fmt.Errorf("update error"))

	asset, err := service.UpdateAsset(ctx, assetID, UpdateAssetInput{}, userID)

	assert.Error(t, err)
	assert.Nil(t, asset)
	assert.Contains(t, err.Error(), "failed to update asset")

	mockRepo.AssertExpectations(t)
}

func TestAssetServiceDeleteAsset(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()
	existing := &model.Asset{ID: assetID, UserID: userID}

	params := util.FindUniqueParams{Where: map[string]any{"id": assetID, "user_id": userID}}

	mockRepo.On("FindUnique", ctx, params).Return(existing, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Asset")).Return(nil)

	err := service.DeleteAsset(ctx, assetID, userID)

	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestAssetServiceDeleteAssetNotFound(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{Where: map[string]any{"id": assetID, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return((*model.Asset)(nil), nil)

	err := service.DeleteAsset(ctx, assetID, userID)

	assert.ErrorIs(t, err, ErrAssetNotFound)
	mockRepo.AssertExpectations(t)
}

func TestAssetServiceDeleteAssetFindUniqueError(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()

	params := util.FindUniqueParams{Where: map[string]any{"id": assetID, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return((*model.Asset)(nil), fmt.Errorf("db down"))

	err := service.DeleteAsset(ctx, assetID, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get asset")
	mockRepo.AssertExpectations(t)
}

func TestAssetServiceDeleteAssetUpdateError(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()
	existing := &model.Asset{ID: assetID, UserID: userID}

	params := util.FindUniqueParams{Where: map[string]any{"id": assetID, "user_id": userID}}
	mockRepo.On("FindUnique", ctx, params).Return(existing, nil)
	mockRepo.On("Update", ctx, mock.AnythingOfType("*model.Asset")).Return(fmt.Errorf("update failed"))

	err := service.DeleteAsset(ctx, assetID, userID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "update failed")
	mockRepo.AssertExpectations(t)
}

func TestIsValidAssetType(t *testing.T) {
	tests := []struct {
		name      string
		assetType model.AssetType
		expected  bool
	}{
		{"Valid Crypto Type", model.AssetTypeCrypto, true},
		{"Valid Stock Type", model.AssetTypeStock, true},
		{"Valid MutualFund Type", model.AssetTypeMutualFund, true},
		{"Valid Commodity Type", model.AssetTypeCommodity, true},
		{"Valid Forex Type", model.AssetTypeForex, true},
		{"Valid Other Type", model.AssetTypeOther, true},
		{"Invalid Type", "INVALID", false},
		{"Empty Type", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidAssetType(tt.assetType)
			assert.Equal(t, tt.expected, result)
		})
	}
}
