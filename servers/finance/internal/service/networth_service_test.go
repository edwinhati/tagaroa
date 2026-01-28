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

type MockNetworthAssetRepository struct {
	mock.Mock
}

func (m *MockNetworthAssetRepository) Create(ctx context.Context, asset *model.Asset) error {
	args := m.Called(ctx, asset)
	return args.Error(0)
}

func (m *MockNetworthAssetRepository) FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Asset, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockNetworthAssetRepository) FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Asset, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]*model.Asset), args.Error(1)
}

func (m *MockNetworthAssetRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	args := m.Called(ctx, where)
	return args.Int(0), args.Error(1)
}

func (m *MockNetworthAssetRepository) Update(ctx context.Context, asset *model.Asset) error {
	args := m.Called(ctx, asset)
	return args.Error(0)
}

func (m *MockNetworthAssetRepository) SumByUserAndCurrency(ctx context.Context, userID uuid.UUID, currency string) (float64, error) {
	args := m.Called(ctx, userID, currency)
	return args.Get(0).(float64), args.Error(1)
}

type MockNetworthLiabilityRepository struct {
	mock.Mock
}

func (m *MockNetworthLiabilityRepository) Create(ctx context.Context, liability *model.Liability) error {
	args := m.Called(ctx, liability)
	return args.Error(0)
}

func (m *MockNetworthLiabilityRepository) FindUnique(ctx context.Context, params util.FindUniqueParams) (*model.Liability, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Liability), args.Error(1)
}

func (m *MockNetworthLiabilityRepository) FindMany(ctx context.Context, params util.FindManyParams) ([]*model.Liability, error) {
	args := m.Called(ctx, params)
	return args.Get(0).([]*model.Liability), args.Error(1)
}

func (m *MockNetworthLiabilityRepository) Count(ctx context.Context, where map[string]any) (int, error) {
	args := m.Called(ctx, where)
	return args.Int(0), args.Error(1)
}

func (m *MockNetworthLiabilityRepository) Update(ctx context.Context, liability *model.Liability) error {
	args := m.Called(ctx, liability)
	return args.Error(0)
}

func (m *MockNetworthLiabilityRepository) SumByUserAndCurrency(ctx context.Context, userID uuid.UUID, currency string) (float64, error) {
	args := m.Called(ctx, userID, currency)
	return args.Get(0).(float64), args.Error(1)
}

type MockNetworthRepository struct {
	mock.Mock
}

func (m *MockNetworthRepository) Insert(ctx context.Context, record *model.NetworthHistory) error {
	args := m.Called(ctx, record)
	return args.Error(0)
}

func (m *MockNetworthRepository) GetHistory(ctx context.Context, userID uuid.UUID, currency string, from, to time.Time) ([]*model.NetworthHistory, error) {
	args := m.Called(ctx, userID, currency, from, to)
	return args.Get(0).([]*model.NetworthHistory), args.Error(1)
}

func (m *MockNetworthRepository) GetLatest(ctx context.Context, userID uuid.UUID, currency string) (*model.NetworthHistory, error) {
	args := m.Called(ctx, userID, currency)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.NetworthHistory), args.Error(1)
}

func (m *MockNetworthRepository) InitSchema(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func TestNetworthServiceGetCurrentNetworth(t *testing.T) {
	assetRepo := new(MockNetworthAssetRepository)
	liabilityRepo := new(MockNetworthLiabilityRepository)
	networthRepo := new(MockNetworthRepository)
	service := NewNetworthService(assetRepo, liabilityRepo, networthRepo)

	ctx := context.Background()
	userID := uuid.New()
	currency := "USD"

	assetRepo.On("SumByUserAndCurrency", ctx, userID, currency).Return(10000.0, nil)
	liabilityRepo.On("SumByUserAndCurrency", ctx, userID, currency).Return(2000.0, nil)

	result, err := service.GetCurrentNetworth(ctx, userID, currency)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, userID, result.UserID)
	assert.Equal(t, 10000.0, result.TotalAssets)
	assert.Equal(t, 2000.0, result.TotalLiabilities)
	assert.Equal(t, 8000.0, result.Networth)
	assert.Equal(t, currency, result.Currency)

	assetRepo.AssertExpectations(t)
	liabilityRepo.AssertExpectations(t)
}

func TestNetworthServiceGetCurrentNetworthAssetError(t *testing.T) {
	assetRepo := new(MockNetworthAssetRepository)
	liabilityRepo := new(MockNetworthLiabilityRepository)
	networthRepo := new(MockNetworthRepository)
	service := NewNetworthService(assetRepo, liabilityRepo, networthRepo)

	ctx := context.Background()
	userID := uuid.New()
	currency := "USD"

	assetRepo.On("SumByUserAndCurrency", ctx, userID, currency).Return(0.0, fmt.Errorf("asset error"))

	result, err := service.GetCurrentNetworth(ctx, userID, currency)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to sum assets")

	assetRepo.AssertExpectations(t)
}

func TestNetworthServiceGetCurrentNetworthLiabilityError(t *testing.T) {
	assetRepo := new(MockNetworthAssetRepository)
	liabilityRepo := new(MockNetworthLiabilityRepository)
	networthRepo := new(MockNetworthRepository)
	service := NewNetworthService(assetRepo, liabilityRepo, networthRepo)

	ctx := context.Background()
	userID := uuid.New()
	currency := "USD"

	assetRepo.On("SumByUserAndCurrency", ctx, userID, currency).Return(10000.0, nil)
	liabilityRepo.On("SumByUserAndCurrency", ctx, userID, currency).Return(0.0, fmt.Errorf("liability error"))

	result, err := service.GetCurrentNetworth(ctx, userID, currency)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to sum liabilities")

	assetRepo.AssertExpectations(t)
	liabilityRepo.AssertExpectations(t)
}

func TestNetworthServiceGetNetworthHistory(t *testing.T) {
	assetRepo := new(MockNetworthAssetRepository)
	liabilityRepo := new(MockNetworthLiabilityRepository)
	networthRepo := new(MockNetworthRepository)
	service := NewNetworthService(assetRepo, liabilityRepo, networthRepo)

	ctx := context.Background()
	userID := uuid.New()
	currency := "USD"
	from := time.Now().AddDate(0, -1, 0)
	to := time.Now()

	expectedHistory := []*model.NetworthHistory{
		{ID: uuid.New(), UserID: userID, TotalAssets: 10000.0, TotalLiabilities: 2000.0, Networth: 8000.0, Currency: currency},
	}

	networthRepo.On("GetHistory", ctx, userID, currency, from, to).Return(expectedHistory, nil)

	result, err := service.GetNetworthHistory(ctx, userID, currency, from, to)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Len(t, result, 1)
	assert.Equal(t, 8000.0, result[0].Networth)

	networthRepo.AssertExpectations(t)
}

func TestNetworthServiceGetNetworthHistoryError(t *testing.T) {
	assetRepo := new(MockNetworthAssetRepository)
	liabilityRepo := new(MockNetworthLiabilityRepository)
	networthRepo := new(MockNetworthRepository)
	service := NewNetworthService(assetRepo, liabilityRepo, networthRepo)

	ctx := context.Background()
	userID := uuid.New()
	currency := "USD"
	from := time.Now().AddDate(0, -1, 0)
	to := time.Now()

	networthRepo.On("GetHistory", ctx, userID, currency, from, to).Return([]*model.NetworthHistory(nil), fmt.Errorf("history error"))

	result, err := service.GetNetworthHistory(ctx, userID, currency, from, to)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "history error")

	networthRepo.AssertExpectations(t)
}

func TestNetworthServiceRecordNetworth(t *testing.T) {
	assetRepo := new(MockNetworthAssetRepository)
	liabilityRepo := new(MockNetworthLiabilityRepository)
	networthRepo := new(MockNetworthRepository)
	service := NewNetworthService(assetRepo, liabilityRepo, networthRepo)

	ctx := context.Background()
	userID := uuid.New()
	currency := "USD"

	assetRepo.On("SumByUserAndCurrency", ctx, userID, currency).Return(10000.0, nil)
	liabilityRepo.On("SumByUserAndCurrency", ctx, userID, currency).Return(2000.0, nil)
	networthRepo.On("Insert", ctx, mock.AnythingOfType("*model.NetworthHistory")).Return(nil)

	result, err := service.RecordNetworth(ctx, userID, currency)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 8000.0, result.Networth)

	assetRepo.AssertExpectations(t)
	liabilityRepo.AssertExpectations(t)
	networthRepo.AssertExpectations(t)
}

func TestNetworthServiceRecordNetworthInsertError(t *testing.T) {
	assetRepo := new(MockNetworthAssetRepository)
	liabilityRepo := new(MockNetworthLiabilityRepository)
	networthRepo := new(MockNetworthRepository)
	service := NewNetworthService(assetRepo, liabilityRepo, networthRepo)

	ctx := context.Background()
	userID := uuid.New()
	currency := "USD"

	assetRepo.On("SumByUserAndCurrency", ctx, userID, currency).Return(10000.0, nil)
	liabilityRepo.On("SumByUserAndCurrency", ctx, userID, currency).Return(2000.0, nil)
	networthRepo.On("Insert", ctx, mock.AnythingOfType("*model.NetworthHistory")).Return(fmt.Errorf("insert error"))

	result, err := service.RecordNetworth(ctx, userID, currency)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to record networth")

	assetRepo.AssertExpectations(t)
	liabilityRepo.AssertExpectations(t)
	networthRepo.AssertExpectations(t)
}

func TestNetworthServiceRecordNetworthGetCurrentError(t *testing.T) {
	assetRepo := new(MockNetworthAssetRepository)
	liabilityRepo := new(MockNetworthLiabilityRepository)
	networthRepo := new(MockNetworthRepository)
	service := NewNetworthService(assetRepo, liabilityRepo, networthRepo)

	ctx := context.Background()
	userID := uuid.New()
	currency := "USD"

	assetRepo.On("SumByUserAndCurrency", ctx, userID, currency).Return(0.0, fmt.Errorf("asset error"))

	result, err := service.RecordNetworth(ctx, userID, currency)

	assert.Error(t, err)
	assert.Nil(t, result)

	assetRepo.AssertExpectations(t)
	liabilityRepo.AssertExpectations(t)
	networthRepo.AssertExpectations(t)
}

func TestNewNetworthService(t *testing.T) {
	assetRepo := new(MockNetworthAssetRepository)
	liabilityRepo := new(MockNetworthLiabilityRepository)
	networthRepo := new(MockNetworthRepository)

	service := NewNetworthService(assetRepo, liabilityRepo, networthRepo)

	assert.NotNil(t, service)
}
