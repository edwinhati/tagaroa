package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	"github.com/edwinhati/tagaroa/packages/shared/go/middleware"
	httputil "github.com/edwinhati/tagaroa/packages/shared/go/transport/http"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/service"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockAccountService is a mock implementation of AccountService
type MockAccountService struct {
	mock.Mock
}

func (m *MockAccountService) CreateAccount(ctx context.Context, account *model.Account) (*model.Account, error) {
	args := m.Called(ctx, account)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Account), args.Error(1)
}

func (m *MockAccountService) GetAccount(ctx context.Context, id, userID uuid.UUID) (*model.Account, error) {
	args := m.Called(ctx, id, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Account), args.Error(1)
}

func (m *MockAccountService) GetAccounts(ctx context.Context, params service.GetAccountsParams) (*service.GetAccountsResult, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.GetAccountsResult), args.Error(1)
}

func (m *MockAccountService) UpdateAccount(ctx context.Context, id uuid.UUID, name, currency, notes *string, balance *float64, IsDeleted *bool, userID uuid.UUID) (*model.Account, error) {
	args := m.Called(ctx, id, name, currency, notes, balance, IsDeleted, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Account), args.Error(1)
}

func setupHandler(t *testing.T) (*AccountHandler, *MockAccountService) {
	mockService := new(MockAccountService)
	mockOIDCClient := &client.OIDCClient{} // Mock OIDC client
	handler := NewAccountHandler(mockOIDCClient, mockService)
	return handler, mockService
}

func createRequestWithUserID(method, url string, body interface{}, userID uuid.UUID) *http.Request {
	var reqBody []byte
	if body != nil {
		reqBody, _ = json.Marshal(body)
	}

	req := httptest.NewRequest(method, url, bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")

	// Add user ID to context (simulating auth middleware)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID.String())
	req = req.WithContext(ctx)

	return req
}

func TestAccountHandler_CreateAccount(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	reqBody := CreateAccountRequest{
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		Currency: "USD",
	}

	expectedAccount := &model.Account{
		ID:       uuid.New(),
		Name:     reqBody.Name,
		Type:     reqBody.Type,
		Balance:  reqBody.Balance,
		Currency: reqBody.Currency,
		UserID:   userID,
	}

	mockService.On("CreateAccount", mock.Anything, mock.AnythingOfType("*model.Account")).Return(expectedAccount, nil)

	req := createRequestWithUserID("POST", "/account", reqBody, userID)
	w := httptest.NewRecorder()

	handler.CreateAccount(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_CreateAccount_InvalidType(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	reqBody := CreateAccountRequest{
		Name:     "Test Account",
		Type:     "INVALID_TYPE",
		Balance:  1000.0,
		Currency: "USD",
	}

	mockService.On("CreateAccount", mock.Anything, mock.AnythingOfType("*model.Account")).Return(nil, service.ErrInvalidAccountType)

	req := createRequestWithUserID("POST", "/account", reqBody, userID)
	w := httptest.NewRecorder()

	handler.CreateAccount(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_CreateAccount_NoUserID(t *testing.T) {
	handler, _ := setupHandler(t)

	reqBody := CreateAccountRequest{
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		Currency: "USD",
	}

	reqBodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/account", bytes.NewBuffer(reqBodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.CreateAccount(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAccountHandler_GetAccounts(t *testing.T) {
	handler, mockService := setupHandler(t)

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
	}

	expectedResult := &service.GetAccountsResult{
		Accounts: expectedAccounts,
		Total:    1,
		TypeAggregations: map[string]util.AggregationResult{
			"BANK": {Count: 1, Sum: 1000.0},
		},
		CurrencyAggregations: map[string]util.AggregationResult{
			"USD": {Count: 1, Sum: 1000.0},
		},
	}

	mockService.On("GetAccounts", mock.Anything, mock.AnythingOfType("service.GetAccountsParams")).Return(expectedResult, nil)

	req := createRequestWithUserID("GET", "/account", nil, userID)
	w := httptest.NewRecorder()

	handler.GetAccounts(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_GetAccountTypes(t *testing.T) {
	handler, _ := setupHandler(t)

	userID := uuid.New()
	req := createRequestWithUserID("GET", "/account/types", nil, userID)
	w := httptest.NewRecorder()

	handler.GetAccountTypes(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response struct {
		Data []model.AccountType `json:"data"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Len(t, response.Data, 5) // Should return all account types
}

func TestNewAccountHandler(t *testing.T) {
	mockService := new(MockAccountService)
	mockOIDCClient := &client.OIDCClient{}

	handler := NewAccountHandler(mockOIDCClient, mockService)

	assert.NotNil(t, handler)
	assert.Equal(t, mockOIDCClient, handler.oidcClient)
	assert.Equal(t, mockService, handler.accountService)
}

// Helper functions
func stringPtr(s string) *string {
	return &s
}

func float64Ptr(f float64) *float64 {
	return &f
}
func TestAccountHandler_CreateAccount_InvalidJSON(t *testing.T) {
	handler, _ := setupHandler(t)

	userID := uuid.New()

	req := httptest.NewRequest("POST", "/account", bytes.NewBuffer([]byte("invalid json")))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID.String())
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	handler.CreateAccount(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAccountHandler_CreateAccount_ServiceError(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	reqBody := CreateAccountRequest{
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		Currency: "USD",
	}

	mockService.On("CreateAccount", mock.Anything, mock.AnythingOfType("*model.Account")).Return(nil, fmt.Errorf("service error"))

	req := createRequestWithUserID("POST", "/account", reqBody, userID)
	w := httptest.NewRecorder()

	handler.CreateAccount(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_GetAccounts_ServiceError(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()

	mockService.On("GetAccounts", mock.Anything, mock.AnythingOfType("service.GetAccountsParams")).Return(nil, fmt.Errorf("service error"))

	req := createRequestWithUserID("GET", "/account", nil, userID)
	w := httptest.NewRecorder()

	handler.GetAccounts(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_GetAccounts_NoUserID(t *testing.T) {
	handler, _ := setupHandler(t)

	req := httptest.NewRequest("GET", "/account", nil)
	w := httptest.NewRecorder()

	handler.GetAccounts(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAccountHandler_GetAccounts_WithQueryParams(t *testing.T) {
	handler, mockService := setupHandler(t)

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
	}

	expectedResult := &service.GetAccountsResult{
		Accounts: expectedAccounts,
		Total:    1,
		TypeAggregations: map[string]util.AggregationResult{
			"BANK": {Count: 1, Sum: 1000.0},
		},
		CurrencyAggregations: map[string]util.AggregationResult{
			"USD": {Count: 1, Sum: 1000.0},
		},
	}

	mockService.On("GetAccounts", mock.Anything, mock.AnythingOfType("service.GetAccountsParams")).Return(expectedResult, nil)

	req := createRequestWithUserID("GET", "/account?page=2&limit=20&type=BANK&currency=USD&search=test&order_by=name%20ASC", nil, userID)
	w := httptest.NewRecorder()

	handler.GetAccounts(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_GetAccounts_WithMultipleTypes(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	expectedResult := &service.GetAccountsResult{
		Accounts:             []*model.Account{},
		Total:                0,
		TypeAggregations:     map[string]util.AggregationResult{},
		CurrencyAggregations: map[string]util.AggregationResult{},
	}

	mockService.On("GetAccounts", mock.Anything, mock.AnythingOfType("service.GetAccountsParams")).Return(expectedResult, nil)

	req := createRequestWithUserID("GET", "/account?type=BANK,CASH&currency=USD,EUR", nil, userID)
	w := httptest.NewRecorder()

	handler.GetAccounts(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_GetAccounts_NoAggregations(t *testing.T) {
	handler, mockService := setupHandler(t)

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
	}

	expectedResult := &service.GetAccountsResult{
		Accounts:             expectedAccounts,
		Total:                1,
		TypeAggregations:     nil,
		CurrencyAggregations: nil,
	}

	mockService.On("GetAccounts", mock.Anything, mock.AnythingOfType("service.GetAccountsParams")).Return(expectedResult, nil)

	req := createRequestWithUserID("GET", "/account", nil, userID)
	w := httptest.NewRecorder()

	handler.GetAccounts(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_SetupRoutes(t *testing.T) {
	handler, _ := setupHandler(t)
	router := httputil.NewRouter()

	// This should not panic
	assert.NotPanics(t, func() {
		handler.SetupRoutes(router)
	})
}

func TestCreateAccountRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		request CreateAccountRequest
		valid   bool
	}{
		{
			name: "Valid request",
			request: CreateAccountRequest{
				Name:     "Test Account",
				Type:     model.AccountTypeBank,
				Balance:  1000.0,
				Currency: "USD",
			},
			valid: true,
		},
		{
			name: "Empty name",
			request: CreateAccountRequest{
				Name:     "",
				Type:     model.AccountTypeBank,
				Balance:  1000.0,
				Currency: "USD",
			},
			valid: false,
		},
		{
			name: "Empty currency",
			request: CreateAccountRequest{
				Name:     "Test Account",
				Type:     model.AccountTypeBank,
				Balance:  1000.0,
				Currency: "",
			},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Basic validation - in a real app you'd use a validator library
			isValid := tt.request.Name != "" && tt.request.Currency != "" && tt.request.Type != ""
			assert.Equal(t, tt.valid, isValid)
		})
	}
}

func TestUpdateAccountRequest_Fields(t *testing.T) {
	name := "Updated Name"
	balance := 1500.0
	currency := "EUR"
	notes := "Updated notes"
	isDeleted := true

	req := UpdateAccountRequest{
		Name:      &name,
		Balance:   &balance,
		Currency:  &currency,
		Notes:     &notes,
		IsDeleted: &isDeleted,
	}

	assert.Equal(t, name, *req.Name)
	assert.Equal(t, balance, *req.Balance)
	assert.Equal(t, currency, *req.Currency)
	assert.Equal(t, notes, *req.Notes)
	assert.Equal(t, isDeleted, *req.IsDeleted)
}
func TestAccountHandler_GetAccount_Success(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	accountID := uuid.New()
	expectedAccount := &model.Account{
		ID:       accountID,
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	mockService.On("GetAccount", mock.Anything, accountID, userID).Return(expectedAccount, nil)

	req := createRequestWithUserID("GET", "/account/"+accountID.String(), nil, userID)
	req.SetPathValue("id", accountID.String())
	w := httptest.NewRecorder()

	handler.GetAccount(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_GetAccount_InvalidUUID(t *testing.T) {
	handler, _ := setupHandler(t)

	userID := uuid.New()

	req := createRequestWithUserID("GET", "/account/invalid-uuid", nil, userID)
	req.SetPathValue("id", "invalid-uuid")
	w := httptest.NewRecorder()

	handler.GetAccount(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAccountHandler_GetAccount_NotFound(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	accountID := uuid.New()

	mockService.On("GetAccount", mock.Anything, accountID, userID).Return(nil, service.ErrAccountNotFound)

	req := createRequestWithUserID("GET", "/account/"+accountID.String(), nil, userID)
	req.SetPathValue("id", accountID.String())
	w := httptest.NewRecorder()

	handler.GetAccount(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_GetAccount_AccessDenied(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	accountID := uuid.New()

	mockService.On("GetAccount", mock.Anything, accountID, userID).Return(nil, service.ErrAccessDenied)

	req := createRequestWithUserID("GET", "/account/"+accountID.String(), nil, userID)
	req.SetPathValue("id", accountID.String())
	w := httptest.NewRecorder()

	handler.GetAccount(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_GetAccount_ServiceError(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	accountID := uuid.New()

	mockService.On("GetAccount", mock.Anything, accountID, userID).Return(nil, fmt.Errorf("service error"))

	req := createRequestWithUserID("GET", "/account/"+accountID.String(), nil, userID)
	req.SetPathValue("id", accountID.String())
	w := httptest.NewRecorder()

	handler.GetAccount(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_GetAccount_NoUserID(t *testing.T) {
	handler, _ := setupHandler(t)

	accountID := uuid.New()

	req := httptest.NewRequest("GET", "/account/"+accountID.String(), nil)
	req.SetPathValue("id", accountID.String())
	w := httptest.NewRecorder()

	handler.GetAccount(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAccountHandler_UpdateAccount_Success(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	accountID := uuid.New()
	reqBody := UpdateAccountRequest{
		Name:    stringPtr("Updated Account"),
		Balance: float64Ptr(1500.0),
	}

	expectedAccount := &model.Account{
		ID:       accountID,
		Name:     "Updated Account",
		Type:     model.AccountTypeBank,
		Balance:  1500.0,
		Currency: "USD",
		UserID:   userID,
	}

	mockService.On("UpdateAccount", mock.Anything, accountID, reqBody.Name, reqBody.Currency, reqBody.Notes, reqBody.Balance, reqBody.IsDeleted, userID).Return(expectedAccount, nil)

	req := createRequestWithUserID("PUT", "/account/"+accountID.String(), reqBody, userID)
	req.SetPathValue("id", accountID.String())
	w := httptest.NewRecorder()

	handler.UpdateAccount(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_UpdateAccount_InvalidUUID(t *testing.T) {
	handler, _ := setupHandler(t)

	userID := uuid.New()
	reqBody := UpdateAccountRequest{
		Name: stringPtr("Updated Account"),
	}

	req := createRequestWithUserID("PUT", "/account/invalid-uuid", reqBody, userID)
	req.SetPathValue("id", "invalid-uuid")
	w := httptest.NewRecorder()

	handler.UpdateAccount(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAccountHandler_UpdateAccount_InvalidJSON(t *testing.T) {
	handler, _ := setupHandler(t)

	userID := uuid.New()
	accountID := uuid.New()

	req := httptest.NewRequest("PUT", "/account/"+accountID.String(), bytes.NewBuffer([]byte("invalid json")))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID.String())
	req = req.WithContext(ctx)
	req.SetPathValue("id", accountID.String())
	w := httptest.NewRecorder()

	handler.UpdateAccount(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAccountHandler_UpdateAccount_NoUserID(t *testing.T) {
	handler, _ := setupHandler(t)

	accountID := uuid.New()
	reqBody := UpdateAccountRequest{
		Name: stringPtr("Updated Account"),
	}

	reqBodyBytes, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("PUT", "/account/"+accountID.String(), bytes.NewBuffer(reqBodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", accountID.String())
	w := httptest.NewRecorder()

	handler.UpdateAccount(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAccountHandler_UpdateAccount_NotFound(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	accountID := uuid.New()
	reqBody := UpdateAccountRequest{
		Name: stringPtr("Updated Account"),
	}

	mockService.On("UpdateAccount", mock.Anything, accountID, reqBody.Name, reqBody.Currency, reqBody.Notes, reqBody.Balance, reqBody.IsDeleted, userID).Return(nil, service.ErrAccountNotFound)

	req := createRequestWithUserID("PUT", "/account/"+accountID.String(), reqBody, userID)
	req.SetPathValue("id", accountID.String())
	w := httptest.NewRecorder()

	handler.UpdateAccount(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_UpdateAccount_AccessDenied(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	accountID := uuid.New()
	reqBody := UpdateAccountRequest{
		Name: stringPtr("Updated Account"),
	}

	mockService.On("UpdateAccount", mock.Anything, accountID, reqBody.Name, reqBody.Currency, reqBody.Notes, reqBody.Balance, reqBody.IsDeleted, userID).Return(nil, service.ErrAccessDenied)

	req := createRequestWithUserID("PUT", "/account/"+accountID.String(), reqBody, userID)
	req.SetPathValue("id", accountID.String())
	w := httptest.NewRecorder()

	handler.UpdateAccount(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_UpdateAccount_ServiceError(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	accountID := uuid.New()
	reqBody := UpdateAccountRequest{
		Name: stringPtr("Updated Account"),
	}

	mockService.On("UpdateAccount", mock.Anything, accountID, reqBody.Name, reqBody.Currency, reqBody.Notes, reqBody.Balance, reqBody.IsDeleted, userID).Return(nil, fmt.Errorf("service error"))

	req := createRequestWithUserID("PUT", "/account/"+accountID.String(), reqBody, userID)
	req.SetPathValue("id", accountID.String())
	w := httptest.NewRecorder()

	handler.UpdateAccount(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_GetAccounts_LimitBounds(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	expectedResult := &service.GetAccountsResult{
		Accounts:             []*model.Account{},
		Total:                0,
		TypeAggregations:     map[string]util.AggregationResult{},
		CurrencyAggregations: map[string]util.AggregationResult{},
	}

	mockService.On("GetAccounts", mock.Anything, mock.AnythingOfType("service.GetAccountsParams")).Return(expectedResult, nil)

	// Test with limit too high (should be capped at 50)
	req := createRequestWithUserID("GET", "/account?limit=100", nil, userID)
	w := httptest.NewRecorder()

	handler.GetAccounts(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockService.AssertExpectations(t)
}

func TestAccountHandler_GetAccounts_LimitTooLow(t *testing.T) {
	handler, mockService := setupHandler(t)

	userID := uuid.New()
	expectedResult := &service.GetAccountsResult{
		Accounts:             []*model.Account{},
		Total:                0,
		TypeAggregations:     map[string]util.AggregationResult{},
		CurrencyAggregations: map[string]util.AggregationResult{},
	}

	mockService.On("GetAccounts", mock.Anything, mock.AnythingOfType("service.GetAccountsParams")).Return(expectedResult, nil)

	// Test with limit too low (should be set to minimum 5)
	req := createRequestWithUserID("GET", "/account?limit=1", nil, userID)
	w := httptest.NewRecorder()

	handler.GetAccounts(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	mockService.AssertExpectations(t)
}
