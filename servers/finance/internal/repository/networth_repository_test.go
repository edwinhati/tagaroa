package repository

import (
	"context"
	"testing"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockNetworthRepository struct {
	mock.Mock
}

func (m *MockNetworthRepository) Insert(ctx context.Context, record *model.NetworthHistory) error {
	args := m.Called(ctx, record)
	return args.Error(0)
}

func (m *MockNetworthRepository) GetHistory(ctx context.Context, userID uuid.UUID, currency string, from, to time.Time) ([]*model.NetworthHistory, error) {
	args := m.Called(ctx, userID, currency, from, to)
	var result []*model.NetworthHistory
	if v := args.Get(0); v != nil {
		result = v.([]*model.NetworthHistory)
	}
	return result, args.Error(1)
}

func (m *MockNetworthRepository) GetLatest(ctx context.Context, userID uuid.UUID, currency string) (*model.NetworthHistory, error) {
	args := m.Called(ctx, userID, currency)
	var result *model.NetworthHistory
	if v := args.Get(0); v != nil {
		result = v.(*model.NetworthHistory)
	}
	return result, args.Error(1)
}

func (m *MockNetworthRepository) InitSchema(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func TestNetworthRepositoryInterface(t *testing.T) {
	var repo NetworthRepository = &networthRepository{}
	assert.NotNil(t, repo)
}

func TestNetworthRepositoryNilConnection(t *testing.T) {
	repo := &networthRepository{conn: nil}
	assert.NotNil(t, repo)
}

func TestNewNetworthRepository(t *testing.T) {
	mockRepo := new(MockNetworthRepository)
	repo := NewNetworthRepository(nil)
	assert.NotNil(t, repo)
	_ = mockRepo
}

func TestMockNetworthRepositoryInsert(t *testing.T) {
	mockRepo := new(MockNetworthRepository)

	record := &model.NetworthHistory{
		ID:               uuid.New(),
		Time:             time.Now(),
		UserID:           uuid.New(),
		TotalAssets:      10000,
		TotalLiabilities: 2000,
		Networth:         8000,
		Currency:         "USD",
	}

	mockRepo.On("Insert", mock.Anything, record).Return(nil)

	err := mockRepo.Insert(context.Background(), record)
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestMockNetworthRepositoryInsertWithNilID(t *testing.T) {
	mockRepo := new(MockNetworthRepository)

	record := &model.NetworthHistory{
		ID:               uuid.Nil,
		Time:             time.Now(),
		UserID:           uuid.New(),
		TotalAssets:      10000,
		TotalLiabilities: 2000,
		Networth:         8000,
		Currency:         "USD",
	}

	mockRepo.On("Insert", mock.Anything, mock.AnythingOfType("*model.NetworthHistory")).Return(nil)

	err := mockRepo.Insert(context.Background(), record)
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestMockNetworthRepositoryInsertError(t *testing.T) {
	mockRepo := new(MockNetworthRepository)

	record := &model.NetworthHistory{
		ID:               uuid.New(),
		Time:             time.Now(),
		UserID:           uuid.New(),
		TotalAssets:      10000,
		TotalLiabilities: 2000,
		Networth:         8000,
		Currency:         "USD",
	}

	mockRepo.On("Insert", mock.Anything, mock.Anything).Return(context.DeadlineExceeded)

	err := mockRepo.Insert(context.Background(), record)
	assert.Error(t, err)
	assert.Equal(t, context.DeadlineExceeded, err)
	mockRepo.AssertExpectations(t)
}

func TestMockNetworthRepositoryGetHistory(t *testing.T) {
	mockRepo := new(MockNetworthRepository)

	userID := uuid.New()
	currency := "USD"
	from := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2025, 12, 31, 23, 59, 59, 0, time.UTC)

	expected := []*model.NetworthHistory{
		{
			ID:               uuid.New(),
			Time:             time.Now(),
			UserID:           userID,
			TotalAssets:      10000,
			TotalLiabilities: 2000,
			Networth:         8000,
			Currency:         currency,
		},
	}

	mockRepo.On("GetHistory", mock.Anything, userID, currency, from, to).Return(expected, nil)

	result, err := mockRepo.GetHistory(context.Background(), userID, currency, from, to)
	assert.NoError(t, err)
	assert.Len(t, result, 1)
	assert.Equal(t, expected[0].ID, result[0].ID)
	mockRepo.AssertExpectations(t)
}

func TestMockNetworthRepositoryGetHistoryEmpty(t *testing.T) {
	mockRepo := new(MockNetworthRepository)

	mockRepo.On("GetHistory", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]*model.NetworthHistory{}, nil)

	result, err := mockRepo.GetHistory(context.Background(), uuid.New(), "USD", time.Now(), time.Now())
	assert.NoError(t, err)
	assert.Empty(t, result)
	mockRepo.AssertExpectations(t)
}

func TestMockNetworthRepositoryGetHistoryError(t *testing.T) {
	mockRepo := new(MockNetworthRepository)

	mockRepo.On("GetHistory", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, context.DeadlineExceeded)

	result, err := mockRepo.GetHistory(context.Background(), uuid.New(), "USD", time.Now(), time.Now())
	assert.Error(t, err)
	assert.Nil(t, result)
	mockRepo.AssertExpectations(t)
}

func TestMockNetworthRepositoryGetLatest(t *testing.T) {
	mockRepo := new(MockNetworthRepository)

	userID := uuid.New()
	currency := "USD"
	expected := &model.NetworthHistory{
		ID:               uuid.New(),
		Time:             time.Now(),
		UserID:           userID,
		TotalAssets:      10000,
		TotalLiabilities: 2000,
		Networth:         8000,
		Currency:         currency,
	}

	mockRepo.On("GetLatest", mock.Anything, userID, currency).Return(expected, nil)

	result, err := mockRepo.GetLatest(context.Background(), userID, currency)
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, expected.ID, result.ID)
	mockRepo.AssertExpectations(t)
}

func TestMockNetworthRepositoryGetLatestNotFound(t *testing.T) {
	mockRepo := new(MockNetworthRepository)

	mockRepo.On("GetLatest", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)

	result, err := mockRepo.GetLatest(context.Background(), uuid.New(), "USD")
	assert.NoError(t, err)
	assert.Nil(t, result)
	mockRepo.AssertExpectations(t)
}

func TestMockNetworthRepositoryGetLatestError(t *testing.T) {
	mockRepo := new(MockNetworthRepository)

	mockRepo.On("GetLatest", mock.Anything, mock.Anything, mock.Anything).Return(nil, context.DeadlineExceeded)

	result, err := mockRepo.GetLatest(context.Background(), uuid.New(), "USD")
	assert.Error(t, err)
	assert.Nil(t, result)
	mockRepo.AssertExpectations(t)
}

func TestMockNetworthRepositoryInitSchema(t *testing.T) {
	mockRepo := new(MockNetworthRepository)

	mockRepo.On("InitSchema", mock.Anything).Return(nil)

	err := mockRepo.InitSchema(context.Background())
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestMockNetworthRepositoryInitSchemaError(t *testing.T) {
	mockRepo := new(MockNetworthRepository)

	mockRepo.On("InitSchema", mock.Anything).Return(context.DeadlineExceeded)

	err := mockRepo.InitSchema(context.Background())
	assert.Error(t, err)
	assert.Equal(t, context.DeadlineExceeded, err)
	mockRepo.AssertExpectations(t)
}

func TestNetworthHistoryModel(t *testing.T) {
	t.Run("create NetworthHistory", func(t *testing.T) {
		id := uuid.New()
		userID := uuid.New()
		now := time.Now()

		history := &model.NetworthHistory{
			ID:               id,
			UserID:           userID,
			TotalAssets:      100000.50,
			TotalLiabilities: 50000.25,
			Networth:         50000.25,
			Currency:         "USD",
			Time:             now,
		}

		assert.Equal(t, id, history.ID)
		assert.Equal(t, userID, history.UserID)
		assert.Equal(t, 100000.50, history.TotalAssets)
		assert.Equal(t, 50000.25, history.TotalLiabilities)
		assert.Equal(t, 50000.25, history.Networth)
		assert.Equal(t, "USD", history.Currency)
		assert.Equal(t, now, history.Time)
	})
}
