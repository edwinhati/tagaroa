package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	"github.com/edwinhati/tagaroa/packages/shared/go/router"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/service"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const (
	accountPath                = "/account"
	accountPathWithIDPrefix    = "/account/"
	accountTypesPath           = "/account/types"
	headerContentType          = "Content-Type"
	headerJSONValue            = "application/json"
	invalidJSONBody            = "invalid json"
	invalidUUIDCaseName        = "invalid uuid"
	noUserIDCaseName           = "no user id"
	serviceErrorCaseName       = "service error"
	modelAccountTypeName       = "*model.Account"
	serviceGetAccountsTypeName = "service.GetAccountsParams"
	defaultAccountName         = "Account 1"
	testAccountName            = "Test Account"
	updatedAccountName         = "Updated Account"
	invalidUUIDValue           = "invalid-uuid"
	budgetPath                 = "/budget"
	budgetsPath                = "/budgets"
	budgetPathWithIDPrefix     = "/budget/"
	budgetItemPathPrefix       = "/budget/item/"
)

/* ----------------------- Mocks & small helpers ----------------------- */

type MockAccountService struct{ mock.Mock }

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

func (m *MockAccountService) UpdateAccount(ctx context.Context, id uuid.UUID, input service.UpdateAccountInput, userID uuid.UUID) (*model.Account, error) {
	args := m.Called(ctx, id, input, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Account), args.Error(1)
}

func (m *MockAccountService) DeleteAccount(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

type MockBudgetService struct{ mock.Mock }

func (m *MockBudgetService) CreateBudget(ctx context.Context, budget *model.Budget) (*model.Budget, error) {
	args := m.Called(ctx, budget)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Budget), args.Error(1)
}

func (m *MockBudgetService) UpdateBudget(ctx context.Context, id uuid.UUID, input service.UpdateBudgetInput, userID uuid.UUID) (*model.Budget, error) {
	args := m.Called(ctx, id, input, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Budget), args.Error(1)
}

func (m *MockBudgetService) GetBudget(ctx context.Context, month, year int, userID uuid.UUID) (*model.Budget, error) {
	args := m.Called(ctx, month, year, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Budget), args.Error(1)
}

func (m *MockBudgetService) GetBudgets(ctx context.Context, params service.GetBudgetsParams) (*service.GetBudgetsResult, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.GetBudgetsResult), args.Error(1)
}

func (m *MockBudgetService) CreateBudgetItem(ctx context.Context, item *model.BudgetItem) (*model.BudgetItem, error) {
	args := m.Called(ctx, item)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.BudgetItem), args.Error(1)
}

func (m *MockBudgetService) UpdateBudgetItem(ctx context.Context, item *model.BudgetItem, userID uuid.UUID) (*model.BudgetItem, error) {
	args := m.Called(ctx, item, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.BudgetItem), args.Error(1)
}

func setupHandler(t *testing.T) (*AccountHandler, *MockAccountService) {
	mockSvc := new(MockAccountService)
	mockOIDC := &client.OIDCClient{}
	return NewAccountHandler(mockOIDC, mockSvc), mockSvc
}

func setupBudgetHandler(t *testing.T) (*BudgetHandler, *MockBudgetService) {
	mockSvc := new(MockBudgetService)
	mockOIDC := &client.OIDCClient{}
	return NewBudgetHandler(mockOIDC, mockSvc), mockSvc
}

func accountPathWithID(id uuid.UUID) string {
	return accountPathWithIDPrefix + id.String()
}

func authedReq(method, url string, body any, userID uuid.UUID) *http.Request {
	var buf *bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = bytes.NewBuffer(b)
	} else {
		buf = bytes.NewBuffer(nil)
	}
	req := httptest.NewRequest(method, url, buf)
	req.Header.Set(headerContentType, headerJSONValue)
	ctx := context.WithValue(req.Context(), util.UserIDKey, userID.String())
	return req.WithContext(ctx)
}

func rawReq(method, url string, rawBody []byte) *http.Request {
	req := httptest.NewRequest(method, url, bytes.NewBuffer(rawBody))
	req.Header.Set(headerContentType, headerJSONValue)
	return req
}

func perform(h func(http.ResponseWriter, *http.Request), req *http.Request) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	h(w, req)
	return w
}

func stringPtr(s string) *string    { return &s }
func float64Ptr(f float64) *float64 { return &f }

func updateInputFromRequest(req UpdateAccountRequest) service.UpdateAccountInput {
	return service.UpdateAccountInput{
		Name:     req.Name,
		Currency: req.Currency,
		Notes:    req.Notes,
		Balance:  req.Balance,
	}
}

/* ------------------------------ Create ------------------------------- */

func TestAccountHandlerCreateAccountVariants(t *testing.T) {
	handler, mockSvc := setupHandler(t)
	userID := uuid.New()

	okReq := CreateAccountRequest{
		Name:     testAccountName,
		Type:     model.AccountTypeBank,
		Balance:  1000,
		Currency: "USD",
	}
	okAccount := &model.Account{
		ID:       uuid.New(),
		Name:     okReq.Name,
		Type:     okReq.Type,
		Balance:  okReq.Balance,
		Currency: okReq.Currency,
		UserID:   userID,
	}

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name: "success",
			req:  authedReq("POST", accountPath, okReq, userID),
			mockSetup: func() {
				mockSvc.
					On("CreateAccount", mock.Anything, mock.AnythingOfType(modelAccountTypeName)).
					Return(okAccount, nil).Once()
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "invalid type",
			req:  authedReq("POST", accountPath, CreateAccountRequest{Name: "A", Type: "INVALID", Balance: 10, Currency: "USD"}, userID),
			mockSetup: func() {
				mockSvc.
					On("CreateAccount", mock.Anything, mock.AnythingOfType(modelAccountTypeName)).
					Return(nil, service.ErrInvalidAccountType).Once()
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: invalidJSONBody,
			req: func() *http.Request {
				return authedReq("POST", accountPath, nil, userID).WithContext(authedReq("POST", accountPath, nil, userID).Context())
			}(), // placeholder; will replace body
			mockSetup:  func() { /* no expectations for invalid payload */ },
			wantStatus: http.StatusBadRequest,
		},
		{
			name: serviceErrorCaseName,
			req:  authedReq("POST", accountPath, okReq, userID),
			mockSetup: func() {
				mockSvc.
					On("CreateAccount", mock.Anything, mock.AnythingOfType(modelAccountTypeName)).
					Return(nil, fmt.Errorf(serviceErrorCaseName)).Once()
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       noUserIDCaseName,
			req:        rawReq("POST", accountPath, mustJSON(okReq)),
			mockSetup:  func() { /* unauthorized request has no expectations */ },
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			switch tt.name {
			case invalidJSONBody:
				// craft raw invalid JSON with auth
				r := rawReq("POST", accountPath, []byte(invalidJSONBody))
				ctx := context.WithValue(r.Context(), util.UserIDKey, userID.String())
				tt.req = r.WithContext(ctx)
			}
			tt.mockSetup()
			w := perform(handler.CreateAccount, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

/* ----------------------------- Get many ------------------------------ */

func TestAccountHandlerGetAccountsVariants(t *testing.T) {
	handler, mockSvc := setupHandler(t)
	userID := uuid.New()

	account := &model.Account{
		ID:       uuid.New(),
		Name:     defaultAccountName,
		Type:     model.AccountTypeBank,
		Balance:  1000,
		Currency: "USD",
		UserID:   userID,
	}
	okResult := &service.GetAccountsResult{
		Accounts: []*model.Account{account},
		Total:    1,
		TypeAggregations: map[string]util.AggregationResult{
			"BANK": {Count: 1, Sum: 1000},
		},
		CurrencyAggregations: map[string]util.AggregationResult{
			"USD": {Count: 1, Sum: 1000},
		},
	}
	emptyAgg := &service.GetAccountsResult{
		Accounts:             []*model.Account{account},
		Total:                1,
		TypeAggregations:     nil,
		CurrencyAggregations: nil,
	}
	emptyResult := &service.GetAccountsResult{
		Accounts:             []*model.Account{},
		Total:                0,
		TypeAggregations:     map[string]util.AggregationResult{},
		CurrencyAggregations: map[string]util.AggregationResult{},
	}

	tests := []struct {
		name       string
		req        *http.Request
		mockRet    *service.GetAccountsResult
		mockErr    error
		wantStatus int
	}{
		{"ok", authedReq("GET", accountPath, nil, userID), okResult, nil, http.StatusOK},
		{"with query params", authedReq("GET", accountPath+"?page=2&limit=20&type=BANK&currency=USD&search=test&order_by=name%20ASC", nil, userID), okResult, nil, http.StatusOK},
		{"multiple types", authedReq("GET", accountPath+"?type=BANK,CASH&currency=USD,EUR", nil, userID), emptyResult, nil, http.StatusOK},
		{"no aggregations", authedReq("GET", accountPath, nil, userID), emptyAgg, nil, http.StatusOK},
		{serviceErrorCaseName, authedReq("GET", accountPath, nil, userID), nil, fmt.Errorf("boom"), http.StatusInternalServerError},
		{noUserIDCaseName, rawReq("GET", accountPath, nil), nil, nil, http.StatusUnauthorized},
		{"limit too high", authedReq("GET", accountPath+"?limit=100", nil, userID), emptyResult, nil, http.StatusOK},
		{"limit too low", authedReq("GET", accountPath+"?limit=1", nil, userID), emptyResult, nil, http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.req.Context().Value(util.UserIDKey) != nil {
				mockSvc.
					On("GetAccounts", mock.Anything, mock.AnythingOfType(serviceGetAccountsTypeName)).
					Return(tt.mockRet, tt.mockErr).Once()
			}
			w := perform(handler.GetAccounts, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

/* ----------------------------- Get single ---------------------------- */

func TestAccountHandlerGetAccountVariants(t *testing.T) {
	handler, mockSvc := setupHandler(t)

	userID := uuid.New()
	acc := &model.Account{
		ID:       uuid.New(),
		Name:     testAccountName,
		Type:     model.AccountTypeBank,
		Balance:  1000,
		Currency: "USD",
		UserID:   userID,
	}

	tests := []struct {
		name       string
		req        *http.Request
		setup      func()
		wantStatus int
	}{
		{
			name: "success",
			req:  authedReq("GET", accountPathWithID(acc.ID), nil, userID),
			setup: func() {
				// net/http mux path param
				ttReq := authedReq("GET", accountPathWithID(acc.ID), nil, userID)
				ttReq.SetPathValue("id", acc.ID.String())
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "not found",
			req:  authedReq("GET", accountPathWithID(acc.ID), nil, userID),
			setup: func() {
				mockSvc.
					On("GetAccount", mock.Anything, acc.ID, userID).
					Return(nil, service.ErrAccountNotFound).Once()
			},
			wantStatus: http.StatusNotFound,
		},
		{
			name: "access denied",
			req:  authedReq("GET", accountPathWithID(acc.ID), nil, userID),
			setup: func() {
				mockSvc.
					On("GetAccount", mock.Anything, acc.ID, userID).
					Return(nil, service.ErrAccountAccessDenied).Once()
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name: serviceErrorCaseName,
			req:  authedReq("GET", accountPathWithID(acc.ID), nil, userID),
			setup: func() {
				mockSvc.
					On("GetAccount", mock.Anything, acc.ID, userID).
					Return(nil, fmt.Errorf("boom")).Once()
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name: invalidUUIDCaseName,
			req: func() *http.Request {
				r := authedReq("GET", accountPathWithIDPrefix+invalidUUIDValue, nil, userID)
				r.SetPathValue("id", invalidUUIDValue)
				return r
			}(),
			setup:      func() { /* invalid uuid bypasses mocks */ },
			wantStatus: http.StatusBadRequest,
		},
		{
			name: noUserIDCaseName,
			req: func() *http.Request {
				r := rawReq("GET", accountPathWithID(acc.ID), nil)
				r.SetPathValue("id", acc.ID.String())
				return r
			}(),
			setup:      func() { /* unauthorized request */ },
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// ensure path value exists
			if tc.req.PathValue("id") == "" && tc.name != invalidUUIDCaseName && tc.name != noUserIDCaseName {
				tc.req.SetPathValue("id", acc.ID.String())
			}
			if tc.setup != nil {
				// For "success", we must also set up mock after we know the ID
				if tc.name == "success" {
					mockSvc.
						On("GetAccount", mock.Anything, acc.ID, userID).
						Return(acc, nil).Once()
				}
				tc.setup()
			}
			w := perform(handler.GetAccount, tc.req)
			assert.Equal(t, tc.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

/* ------------------------------ Update ------------------------------- */

func TestAccountHandlerUpdateAccountVariants(t *testing.T) {
	handler, mockSvc := setupHandler(t)

	userID := uuid.New()
	accountID := uuid.New()

	body := UpdateAccountRequest{
		Name:    stringPtr(updatedAccountName),
		Balance: float64Ptr(1500),
	}

	okAccount := &model.Account{
		ID:       accountID,
		Name:     updatedAccountName,
		Type:     model.AccountTypeBank,
		Balance:  1500,
		Currency: "USD",
		UserID:   userID,
	}

	tests := []struct {
		name       string
		req        *http.Request
		setup      func()
		wantStatus int
	}{
		{
			name: "success",
			req:  authedReq("PUT", accountPathWithID(accountID), body, userID),
			setup: func() {
				updateInput := updateInputFromRequest(body)
				mockSvc.
					On("UpdateAccount", mock.Anything, accountID, updateInput, userID).
					Return(okAccount, nil).Once()
			},
			wantStatus: http.StatusOK,
		},
		{
			name: invalidUUIDCaseName,
			req: func() *http.Request {
				r := authedReq("PUT", accountPathWithIDPrefix+invalidUUIDValue, body, userID)
				r.SetPathValue("id", invalidUUIDValue)
				return r
			}(),
			setup:      func() { /* invalid path param */ },
			wantStatus: http.StatusBadRequest,
		},
		{
			name: invalidJSONBody,
			req: func() *http.Request {
				r := rawReq("PUT", accountPathWithID(accountID), []byte(invalidJSONBody))
				ctx := context.WithValue(r.Context(), util.UserIDKey, userID.String())
				r = r.WithContext(ctx)
				return r
			}(),
			setup:      func() { /* invalid payload */ },
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "not found",
			req:  authedReq("PUT", accountPathWithID(accountID), body, userID),
			setup: func() {
				updateInput := updateInputFromRequest(body)
				mockSvc.
					On("UpdateAccount", mock.Anything, accountID, updateInput, userID).
					Return(nil, service.ErrAccountNotFound).Once()
			},
			wantStatus: http.StatusNotFound,
		},
		{
			name: "access denied",
			req:  authedReq("PUT", accountPathWithID(accountID), body, userID),
			setup: func() {
				updateInput := updateInputFromRequest(body)
				mockSvc.
					On("UpdateAccount", mock.Anything, accountID, updateInput, userID).
					Return(nil, service.ErrAccountAccessDenied).Once()
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name: serviceErrorCaseName,
			req:  authedReq("PUT", accountPathWithID(accountID), body, userID),
			setup: func() {
				updateInput := updateInputFromRequest(body)
				mockSvc.
					On("UpdateAccount", mock.Anything, accountID, updateInput, userID).
					Return(nil, fmt.Errorf("boom")).Once()
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       noUserIDCaseName,
			req:        rawReq("PUT", accountPathWithID(accountID), mustJSON(body)),
			setup:      func() { /* unauthorized request */ },
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.req.PathValue("id") == "" && tt.name != invalidUUIDCaseName {
				tt.req.SetPathValue("id", accountID.String())
			}
			tt.setup()
			w := perform(handler.UpdateAccount, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

/* ----------------------- Simple/unchanged tests ---------------------- */

func TestAccountHandlerGetAccountTypes(t *testing.T) {
	handler, _ := setupHandler(t)
	userID := uuid.New()

	req := authedReq("GET", accountTypesPath, nil, userID)
	w := perform(handler.GetAccountTypes, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Data []model.AccountType `json:"data"`
	}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Len(t, resp.Data, 5)
}

func TestAccountHandlerSetupRoutes(t *testing.T) {
	handler, _ := setupHandler(t)
	router := router.NewRouter()
	assert.NotPanics(t, func() { handler.SetupRoutes(router) })
}

func TestNewAccountHandler(t *testing.T) {
	svc := new(MockAccountService)
	oidc := &client.OIDCClient{}
	h := NewAccountHandler(oidc, svc)
	assert.NotNil(t, h)
	assert.Equal(t, oidc, h.oidcClient)
	assert.Equal(t, svc, h.accountService)
}

func TestClampLimit(t *testing.T) {
	tests := []struct {
		name     string
		value    int
		expected int
	}{
		{"zero defaults to min", 0, minQueryLimit},
		{"negative defaults to min", -10, minQueryLimit},
		{"below min clamps up", minQueryLimit - 2, minQueryLimit},
		{"within range stays same", 20, 20},
		{"above max clamps down", maxQueryLimit + 5, maxQueryLimit},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, clampLimit(tt.value))
		})
	}
}

func TestConvertAggregations(t *testing.T) {
	t.Run("nil result returns nil", func(t *testing.T) {
		assert.Nil(t, convertAggregations(nil))
	})

	t.Run("empty aggregations return nil", func(t *testing.T) {
		result := &service.GetAccountsResult{}
		assert.Nil(t, convertAggregations(result))
	})

	t.Run("populates aggregation buckets", func(t *testing.T) {
		result := &service.GetAccountsResult{
			TypeAggregations: map[string]util.AggregationResult{
				"BANK": {Count: 2, Sum: 200},
			},
			CurrencyAggregations: map[string]util.AggregationResult{
				"USD": {Count: 3, Sum: 300},
			},
		}

		got := convertAggregations(result)
		require.NotNil(t, got)
		assert.Len(t, *got, 2)

		typeBuckets, ok := (*got)["type"]
		require.True(t, ok)
		assert.Len(t, typeBuckets, 1)
		assert.Equal(t, "BANK", typeBuckets[0].Key)
		assert.EqualValues(t, 2, typeBuckets[0].Count)
		assert.Equal(t, 200.0, typeBuckets[0].Sum)

		currencyBuckets, ok := (*got)["currency"]
		require.True(t, ok)
		assert.Len(t, currencyBuckets, 1)
		assert.Equal(t, "USD", currencyBuckets[0].Key)
		assert.EqualValues(t, 3, currencyBuckets[0].Count)
		assert.Equal(t, 300.0, currencyBuckets[0].Sum)
	})
}

/* ----------------------------- delete account ----------------------------- */

func TestAccountHandlerDeleteAccountVariants(t *testing.T) {
	handler, mockSvc := setupHandler(t)
	userID := uuid.New()
	accountID := uuid.New()

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name: "success",
			req:  authedReq("DELETE", accountPathWithID(accountID), nil, userID),
			mockSetup: func() {
				account := &model.Account{ID: accountID, UserID: userID}
				mockSvc.On("GetAccount", mock.Anything, accountID, userID).Return(account, nil).Once()
				mockSvc.On("DeleteAccount", mock.Anything, accountID, userID).Return(nil).Once()
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "get account not found",
			req:  authedReq("DELETE", accountPathWithID(accountID), nil, userID),
			mockSetup: func() {
				mockSvc.On("GetAccount", mock.Anything, accountID, userID).Return((*model.Account)(nil), service.ErrAccountNotFound).Once()
			},
			wantStatus: http.StatusNotFound,
		},
		{
			name: "get account access denied",
			req:  authedReq("DELETE", accountPathWithID(accountID), nil, userID),
			mockSetup: func() {
				mockSvc.On("GetAccount", mock.Anything, accountID, userID).Return((*model.Account)(nil), service.ErrAccountAccessDenied).Once()
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "get account error",
			req:  authedReq("DELETE", accountPathWithID(accountID), nil, userID),
			mockSetup: func() {
				mockSvc.On("GetAccount", mock.Anything, accountID, userID).Return((*model.Account)(nil), fmt.Errorf("db err")).Once()
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name: "delete not found",
			req:  authedReq("DELETE", accountPathWithID(accountID), nil, userID),
			mockSetup: func() {
				account := &model.Account{ID: accountID, UserID: userID}
				mockSvc.On("GetAccount", mock.Anything, accountID, userID).Return(account, nil).Once()
				mockSvc.On("DeleteAccount", mock.Anything, accountID, userID).Return(service.ErrAccountNotFound).Once()
			},
			wantStatus: http.StatusNotFound,
		},
		{
			name: "delete access denied",
			req:  authedReq("DELETE", accountPathWithID(accountID), nil, userID),
			mockSetup: func() {
				account := &model.Account{ID: accountID, UserID: userID}
				mockSvc.On("GetAccount", mock.Anything, accountID, userID).Return(account, nil).Once()
				mockSvc.On("DeleteAccount", mock.Anything, accountID, userID).Return(service.ErrAccountAccessDenied).Once()
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "delete error",
			req:  authedReq("DELETE", accountPathWithID(accountID), nil, userID),
			mockSetup: func() {
				account := &model.Account{ID: accountID, UserID: userID}
				mockSvc.On("GetAccount", mock.Anything, accountID, userID).Return(account, nil).Once()
				mockSvc.On("DeleteAccount", mock.Anything, accountID, userID).Return(fmt.Errorf("delete err")).Once()
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       invalidUUIDCaseName,
			req:        authedReq("DELETE", accountPathWithIDPrefix+invalidUUIDValue, nil, userID),
			mockSetup:  func() {},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       noUserIDCaseName,
			req:        rawReq("DELETE", accountPathWithID(accountID), nil),
			mockSetup:  func() {},
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc.ExpectedCalls = nil
			mockSvc.Calls = nil
			tt.mockSetup()

			switch tt.name {
			case invalidUUIDCaseName:
				tt.req.SetPathValue("id", invalidUUIDValue)
			default:
				tt.req.SetPathValue("id", accountID.String())
			}

			resp := perform(handler.DeleteAccount, tt.req)
			assert.Equal(t, tt.wantStatus, resp.Code)

			mockSvc.AssertExpectations(t)
		})
	}
}

/* ----------------------------- budget handlers ---------------------------- */

func budgetPathWithID(id uuid.UUID) string {
	return budgetPath + "/" + id.String()
}

func budgetItemPathWithID(id uuid.UUID) string {
	return budgetItemPathPrefix + id.String()
}

func TestBudgetHandlerCreateBudget(t *testing.T) {
	handler, mockSvc := setupBudgetHandler(t)
	userID := uuid.New()
	reqBody := CreateBudgetRequest{Month: 1, Year: 2025, Amount: 100, Currency: "USD"}

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name: "success",
			req:  authedReq("POST", budgetPath, reqBody, userID),
			mockSetup: func() {
				mockSvc.On("CreateBudget", mock.Anything, mock.AnythingOfType("*model.Budget")).
					Return(&model.Budget{ID: uuid.New(), Month: 1, Year: 2025, UserID: userID}, nil).Once()
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "service error",
			req:  authedReq("POST", budgetPath, reqBody, userID),
			mockSetup: func() {
				mockSvc.On("CreateBudget", mock.Anything, mock.AnythingOfType("*model.Budget")).Return((*model.Budget)(nil), fmt.Errorf("fail")).Once()
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       invalidJSONBody,
			req:        rawReq("POST", budgetPath, []byte(invalidJSONBody)),
			mockSetup:  func() {},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       noUserIDCaseName,
			req:        rawReq("POST", budgetPath, mustJSON(reqBody)),
			mockSetup:  func() {},
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc.ExpectedCalls = nil
			mockSvc.Calls = nil
			tt.mockSetup()

			resp := perform(handler.CreateBudget, tt.req)
			assert.Equal(t, tt.wantStatus, resp.Code)

			mockSvc.AssertExpectations(t)
		})
	}
}

func TestBudgetHandlerGetBudget(t *testing.T) {
	handler, mockSvc := setupBudgetHandler(t)
	userID := uuid.New()
	currentMonth := int(time.Now().Month())
	currentYear := time.Now().Year()

	tests := []struct {
		name       string
		mockSetup  func()
		wantStatus int
	}{
		{
			name: "success",
			mockSetup: func() {
				mockSvc.On("GetBudget", mock.Anything, currentMonth, currentYear, userID).Return(&model.Budget{ID: uuid.New(), UserID: userID}, nil).Once()
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "not found",
			mockSetup: func() {
				mockSvc.On("GetBudget", mock.Anything, currentMonth, currentYear, userID).Return((*model.Budget)(nil), service.ErrBudgetNotFound).Once()
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "access denied",
			mockSetup: func() {
				mockSvc.On("GetBudget", mock.Anything, currentMonth, currentYear, userID).Return((*model.Budget)(nil), service.ErrBudgetAccessDenied).Once()
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "service error",
			mockSetup: func() {
				mockSvc.On("GetBudget", mock.Anything, currentMonth, currentYear, userID).Return((*model.Budget)(nil), fmt.Errorf("boom")).Once()
			},
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc.ExpectedCalls = nil
			mockSvc.Calls = nil
			tt.mockSetup()

			req := authedReq("GET", budgetPath, nil, userID)
			resp := perform(handler.GetBudget, req)
			assert.Equal(t, tt.wantStatus, resp.Code)

			mockSvc.AssertExpectations(t)
		})
	}

	t.Run(noUserIDCaseName, func(t *testing.T) {
		req := rawReq("GET", budgetPath, nil)
		resp := perform(handler.GetBudget, req)
		assert.Equal(t, http.StatusUnauthorized, resp.Code)
	})
}

func TestBudgetHandlerGetBudgets(t *testing.T) {
	handler, mockSvc := setupBudgetHandler(t)
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockSvc.On("GetBudgets", mock.Anything, mock.AnythingOfType("service.GetBudgetsParams")).
			Return(&service.GetBudgetsResult{Budgets: []*model.Budget{}, Total: 0}, nil).Once()

		req := authedReq("GET", budgetsPath+"?page=2&limit=5", nil, userID)
		resp := perform(handler.GetBudgets, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("service error", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetBudgets", mock.Anything, mock.AnythingOfType("service.GetBudgetsParams")).
			Return((*service.GetBudgetsResult)(nil), fmt.Errorf("fail")).Once()

		req := authedReq("GET", budgetsPath, nil, userID)
		resp := perform(handler.GetBudgets, req)
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run(noUserIDCaseName, func(t *testing.T) {
		req := rawReq("GET", budgetsPath, nil)
		resp := perform(handler.GetBudgets, req)
		assert.Equal(t, http.StatusUnauthorized, resp.Code)
	})
}

func TestBudgetHandlerUpdateBudget(t *testing.T) {
	handler, mockSvc := setupBudgetHandler(t)
	userID := uuid.New()
	budgetID := uuid.New()
	reqBody := UpdateBudgetRequest{Amount: float64Ptr(200)}

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name: "success",
			req:  authedReq("PUT", budgetPathWithID(budgetID), reqBody, userID),
			mockSetup: func() {
				mockSvc.On("UpdateBudget", mock.Anything, budgetID, mock.AnythingOfType("service.UpdateBudgetInput"), userID).
					Return(&model.Budget{ID: budgetID, UserID: userID}, nil).Once()
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "not found",
			req:  authedReq("PUT", budgetPathWithID(budgetID), reqBody, userID),
			mockSetup: func() {
				mockSvc.On("UpdateBudget", mock.Anything, budgetID, mock.AnythingOfType("service.UpdateBudgetInput"), userID).
					Return((*model.Budget)(nil), service.ErrBudgetNotFound).Once()
			},
			wantStatus: http.StatusNotFound,
		},
		{
			name: "access denied",
			req:  authedReq("PUT", budgetPathWithID(budgetID), reqBody, userID),
			mockSetup: func() {
				mockSvc.On("UpdateBudget", mock.Anything, budgetID, mock.AnythingOfType("service.UpdateBudgetInput"), userID).
					Return((*model.Budget)(nil), service.ErrBudgetAccessDenied).Once()
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "service error",
			req:  authedReq("PUT", budgetPathWithID(budgetID), reqBody, userID),
			mockSetup: func() {
				mockSvc.On("UpdateBudget", mock.Anything, budgetID, mock.AnythingOfType("service.UpdateBudgetInput"), userID).
					Return((*model.Budget)(nil), fmt.Errorf("fail")).Once()
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       invalidUUIDCaseName,
			req:        authedReq("PUT", budgetPathWithIDPrefix+invalidUUIDValue, reqBody, userID),
			mockSetup:  func() {},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       invalidJSONBody,
			req:        rawReq("PUT", budgetPathWithID(budgetID), []byte(invalidJSONBody)),
			mockSetup:  func() {},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       noUserIDCaseName,
			req:        rawReq("PUT", budgetPathWithID(budgetID), mustJSON(reqBody)),
			mockSetup:  func() {},
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc.ExpectedCalls = nil
			mockSvc.Calls = nil
			tt.mockSetup()

			switch tt.name {
			case invalidUUIDCaseName:
				tt.req.SetPathValue("id", invalidUUIDValue)
			default:
				tt.req.SetPathValue("id", budgetID.String())
			}

			resp := perform(handler.UpdateBudget, tt.req)
			assert.Equal(t, tt.wantStatus, resp.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestBudgetHandlerUpdateBudgetItem(t *testing.T) {
	handler, mockSvc := setupBudgetHandler(t)
	userID := uuid.New()
	itemID := uuid.New()
	budgetID := uuid.New()
	reqBody := UpdateBudgetItemRequest{Allocation: 10, Category: "Food", BudgetID: &budgetID}

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name: "success",
			req:  authedReq("PUT", budgetItemPathWithID(itemID), reqBody, userID),
			mockSetup: func() {
				mockSvc.On("UpdateBudgetItem", mock.Anything, mock.AnythingOfType("*model.BudgetItem"), userID).
					Return(&model.BudgetItem{ID: itemID, BudgetID: &budgetID}, nil).Once()
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "not found",
			req:  authedReq("PUT", budgetItemPathWithID(itemID), reqBody, userID),
			mockSetup: func() {
				mockSvc.On("UpdateBudgetItem", mock.Anything, mock.AnythingOfType("*model.BudgetItem"), userID).
					Return((*model.BudgetItem)(nil), service.ErrBudgetNotFound).Once()
			},
			wantStatus: http.StatusNotFound,
		},
		{
			name: "access denied",
			req:  authedReq("PUT", budgetItemPathWithID(itemID), reqBody, userID),
			mockSetup: func() {
				mockSvc.On("UpdateBudgetItem", mock.Anything, mock.AnythingOfType("*model.BudgetItem"), userID).
					Return((*model.BudgetItem)(nil), service.ErrBudgetAccessDenied).Once()
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "service error",
			req:  authedReq("PUT", budgetItemPathWithID(itemID), reqBody, userID),
			mockSetup: func() {
				mockSvc.On("UpdateBudgetItem", mock.Anything, mock.AnythingOfType("*model.BudgetItem"), userID).
					Return((*model.BudgetItem)(nil), fmt.Errorf("fail")).Once()
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name:       invalidUUIDCaseName,
			req:        authedReq("PUT", budgetItemPathPrefix+invalidUUIDValue, reqBody, userID),
			mockSetup:  func() {},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       invalidJSONBody,
			req:        rawReq("PUT", budgetItemPathWithID(itemID), []byte(invalidJSONBody)),
			mockSetup:  func() {},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       noUserIDCaseName,
			req:        rawReq("PUT", budgetItemPathWithID(itemID), mustJSON(reqBody)),
			mockSetup:  func() {},
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc.ExpectedCalls = nil
			mockSvc.Calls = nil
			tt.mockSetup()

			switch tt.name {
			case invalidUUIDCaseName:
				tt.req.SetPathValue("id", invalidUUIDValue)
			default:
				tt.req.SetPathValue("id", itemID.String())
			}

			resp := perform(handler.UpdateBudgetItem, tt.req)
			assert.Equal(t, tt.wantStatus, resp.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestBudgetHandlerSetupRoutes(t *testing.T) {
	handler, _ := setupBudgetHandler(t)
	r := router.NewRouter()

	handler.SetupRoutes(r)
}

/* ------------------------------- utils -------------------------------- */

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

/* ----------------------- Transaction Handler Tests ----------------------- */

const (
	transactionPath           = "/transaction"
	transactionsPath          = "/transactions"
	transactionPathWithPrefix = "/transaction/"
	transactionTypesPath      = "/transaction/types"
)

type MockTransactionService struct{ mock.Mock }

func (m *MockTransactionService) CreateTransaction(ctx context.Context, transaction *model.Transaction) (*model.Transaction, error) {
	args := m.Called(ctx, transaction)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Transaction), args.Error(1)
}

func (m *MockTransactionService) GetTransaction(ctx context.Context, id, userID uuid.UUID) (*model.Transaction, error) {
	args := m.Called(ctx, id, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Transaction), args.Error(1)
}

func (m *MockTransactionService) GetTransactions(ctx context.Context, params service.GetTransactionsParams) (*service.GetTransactionsResult, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.GetTransactionsResult), args.Error(1)
}

func (m *MockTransactionService) UpdateTransaction(ctx context.Context, id uuid.UUID, input service.UpdateTransactionInput, userID uuid.UUID) (*model.Transaction, error) {
	args := m.Called(ctx, id, input, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Transaction), args.Error(1)
}

func (m *MockTransactionService) DeleteTransaction(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func setupTransactionHandler(t *testing.T) (*TransactionHandler, *MockTransactionService) {
	mockSvc := new(MockTransactionService)
	mockOIDC := &client.OIDCClient{}
	return NewTransactionHandler(mockOIDC, mockSvc), mockSvc
}

func transactionPathWithID(id uuid.UUID) string {
	return transactionPathWithPrefix + id.String()
}

func TestTransactionHandlerCreateTransaction(t *testing.T) {
	handler, mockSvc := setupTransactionHandler(t)
	userID := uuid.New()
	accountID := uuid.New()

	okReq := CreateTransactionRequest{
		Amount:    100.0,
		Date:      time.Now(),
		Type:      model.TransactionTypeExpense,
		Currency:  "USD",
		AccountID: accountID,
	}

	t.Run("success", func(t *testing.T) {
		mockSvc.On("CreateTransaction", mock.Anything, mock.AnythingOfType("*model.Transaction")).
			Return(&model.Transaction{ID: uuid.New(), UserID: userID}, nil).Once()

		req := authedReq("POST", transactionPath, okReq, userID)
		resp := perform(handler.CreateTransaction, req)
		assert.Equal(t, http.StatusOK, resp.Code) // Handler returns 200, not 201
		mockSvc.AssertExpectations(t)
	})

	t.Run("invalid type", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("CreateTransaction", mock.Anything, mock.AnythingOfType("*model.Transaction")).
			Return((*model.Transaction)(nil), service.ErrInvalidTransactionType).Once()

		req := authedReq("POST", transactionPath, okReq, userID)
		resp := perform(handler.CreateTransaction, req)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run(serviceErrorCaseName, func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("CreateTransaction", mock.Anything, mock.AnythingOfType("*model.Transaction")).
			Return((*model.Transaction)(nil), fmt.Errorf("fail")).Once()

		req := authedReq("POST", transactionPath, okReq, userID)
		resp := perform(handler.CreateTransaction, req)
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run(invalidJSONBody, func(t *testing.T) {
		req := rawReq("POST", transactionPath, []byte(invalidJSONBody))
		ctx := context.WithValue(req.Context(), util.UserIDKey, userID.String())
		req = req.WithContext(ctx)
		resp := perform(handler.CreateTransaction, req)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run(noUserIDCaseName, func(t *testing.T) {
		req := rawReq("POST", transactionPath, mustJSON(okReq))
		resp := perform(handler.CreateTransaction, req)
		assert.Equal(t, http.StatusUnauthorized, resp.Code)
	})
}

func TestTransactionHandlerGetTransaction(t *testing.T) {
	handler, mockSvc := setupTransactionHandler(t)
	userID := uuid.New()
	transactionID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockSvc.On("GetTransaction", mock.Anything, transactionID, userID).
			Return(&model.Transaction{ID: transactionID, UserID: userID}, nil).Once()

		req := authedReq("GET", transactionPathWithID(transactionID), nil, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.GetTransaction, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("not found", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransaction", mock.Anything, transactionID, userID).
			Return((*model.Transaction)(nil), service.ErrTransactionNotFound).Once()

		req := authedReq("GET", transactionPathWithID(transactionID), nil, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.GetTransaction, req)
		assert.Equal(t, http.StatusNotFound, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("access denied", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransaction", mock.Anything, transactionID, userID).
			Return((*model.Transaction)(nil), service.ErrTransactionAccessDenied).Once()

		req := authedReq("GET", transactionPathWithID(transactionID), nil, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.GetTransaction, req)
		assert.Equal(t, http.StatusForbidden, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run(serviceErrorCaseName, func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransaction", mock.Anything, transactionID, userID).
			Return((*model.Transaction)(nil), fmt.Errorf("fail")).Once()

		req := authedReq("GET", transactionPathWithID(transactionID), nil, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.GetTransaction, req)
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run(invalidUUIDCaseName, func(t *testing.T) {
		req := authedReq("GET", transactionPathWithPrefix+invalidUUIDValue, nil, userID)
		req.SetPathValue("id", invalidUUIDValue)
		resp := perform(handler.GetTransaction, req)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run(noUserIDCaseName, func(t *testing.T) {
		req := rawReq("GET", transactionPathWithID(transactionID), nil)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.GetTransaction, req)
		assert.Equal(t, http.StatusUnauthorized, resp.Code)
	})
}

func TestTransactionHandlerGetTransactions(t *testing.T) {
	handler, mockSvc := setupTransactionHandler(t)
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockSvc.On("GetTransactions", mock.Anything, mock.AnythingOfType("service.GetTransactionsParams")).
			Return(&service.GetTransactionsResult{Transactions: []*model.Transaction{}, Total: 0}, nil).Once()

		req := authedReq("GET", transactionsPath+"?page=1&limit=10", nil, userID)
		resp := perform(handler.GetTransactions, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("with filters", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransactions", mock.Anything, mock.AnythingOfType("service.GetTransactionsParams")).
			Return(&service.GetTransactionsResult{Transactions: []*model.Transaction{}, Total: 0}, nil).Once()

		req := authedReq("GET", transactionsPath+"?type=EXPENSE&currency=USD&account=Bank&category=Food&start_date=2024-01-01&end_date=2024-12-31", nil, userID)
		resp := perform(handler.GetTransactions, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("with aggregations", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransactions", mock.Anything, mock.AnythingOfType("service.GetTransactionsParams")).
			Return(&service.GetTransactionsResult{
				Transactions: []*model.Transaction{},
				Total:        0,
				TypeAggregations: map[string]util.AggregationResult{
					"EXPENSE": {Count: 5, Sum: 500},
				},
				CurrencyAggregations: map[string]util.AggregationResult{
					"USD": {Count: 5, Sum: 500},
				},
				AccountAggregations: map[string]util.AggregationResult{
					"Bank": {Count: 3, Sum: 300},
				},
				CategoryAggregations: map[string]util.AggregationResult{
					"Food": {Count: 2, Sum: 200},
				},
			}, nil).Once()

		req := authedReq("GET", transactionsPath, nil, userID)
		resp := perform(handler.GetTransactions, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run(serviceErrorCaseName, func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransactions", mock.Anything, mock.AnythingOfType("service.GetTransactionsParams")).
			Return((*service.GetTransactionsResult)(nil), fmt.Errorf("fail")).Once()

		req := authedReq("GET", transactionsPath, nil, userID)
		resp := perform(handler.GetTransactions, req)
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run(noUserIDCaseName, func(t *testing.T) {
		req := rawReq("GET", transactionsPath, nil)
		resp := perform(handler.GetTransactions, req)
		assert.Equal(t, http.StatusUnauthorized, resp.Code)
	})
}

func TestTransactionHandlerGetTransactionTypes(t *testing.T) {
	handler, _ := setupTransactionHandler(t)
	userID := uuid.New()

	req := authedReq("GET", transactionTypesPath, nil, userID)
	resp := perform(handler.GetTransactionTypes, req)
	assert.Equal(t, http.StatusOK, resp.Code)
}

func TestTransactionHandlerUpdateTransaction(t *testing.T) {
	handler, mockSvc := setupTransactionHandler(t)
	userID := uuid.New()
	transactionID := uuid.New()
	newAmount := 200.0
	reqBody := UpdateTransactionRequest{Amount: &newAmount}

	t.Run("success", func(t *testing.T) {
		mockSvc.On("UpdateTransaction", mock.Anything, transactionID, mock.AnythingOfType("service.UpdateTransactionInput"), userID).
			Return(&model.Transaction{ID: transactionID, UserID: userID}, nil).Once()

		req := authedReq("PUT", transactionPathWithID(transactionID), reqBody, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.UpdateTransaction, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("not found", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("UpdateTransaction", mock.Anything, transactionID, mock.AnythingOfType("service.UpdateTransactionInput"), userID).
			Return((*model.Transaction)(nil), service.ErrTransactionNotFound).Once()

		req := authedReq("PUT", transactionPathWithID(transactionID), reqBody, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.UpdateTransaction, req)
		assert.Equal(t, http.StatusNotFound, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("access denied", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("UpdateTransaction", mock.Anything, transactionID, mock.AnythingOfType("service.UpdateTransactionInput"), userID).
			Return((*model.Transaction)(nil), service.ErrTransactionAccessDenied).Once()

		req := authedReq("PUT", transactionPathWithID(transactionID), reqBody, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.UpdateTransaction, req)
		assert.Equal(t, http.StatusForbidden, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run(serviceErrorCaseName, func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("UpdateTransaction", mock.Anything, transactionID, mock.AnythingOfType("service.UpdateTransactionInput"), userID).
			Return((*model.Transaction)(nil), fmt.Errorf("fail")).Once()

		req := authedReq("PUT", transactionPathWithID(transactionID), reqBody, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.UpdateTransaction, req)
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run(invalidUUIDCaseName, func(t *testing.T) {
		req := authedReq("PUT", transactionPathWithPrefix+invalidUUIDValue, reqBody, userID)
		req.SetPathValue("id", invalidUUIDValue)
		resp := perform(handler.UpdateTransaction, req)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run(invalidJSONBody, func(t *testing.T) {
		req := rawReq("PUT", transactionPathWithID(transactionID), []byte(invalidJSONBody))
		ctx := context.WithValue(req.Context(), util.UserIDKey, userID.String())
		req = req.WithContext(ctx)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.UpdateTransaction, req)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run(noUserIDCaseName, func(t *testing.T) {
		req := rawReq("PUT", transactionPathWithID(transactionID), mustJSON(reqBody))
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.UpdateTransaction, req)
		assert.Equal(t, http.StatusUnauthorized, resp.Code)
	})
}

func TestTransactionHandlerDeleteTransaction(t *testing.T) {
	handler, mockSvc := setupTransactionHandler(t)
	userID := uuid.New()
	transactionID := uuid.New()
	transaction := &model.Transaction{ID: transactionID, UserID: userID}

	t.Run("success", func(t *testing.T) {
		// Handler calls GetTransaction first, then DeleteTransaction
		mockSvc.On("GetTransaction", mock.Anything, transactionID, userID).
			Return(transaction, nil).Once()
		mockSvc.On("DeleteTransaction", mock.Anything, transactionID, userID).
			Return(nil).Once()

		req := authedReq("DELETE", transactionPathWithID(transactionID), nil, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.DeleteTransaction, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("get not found", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransaction", mock.Anything, transactionID, userID).
			Return((*model.Transaction)(nil), service.ErrTransactionNotFound).Once()

		req := authedReq("DELETE", transactionPathWithID(transactionID), nil, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.DeleteTransaction, req)
		assert.Equal(t, http.StatusNotFound, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("get access denied", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransaction", mock.Anything, transactionID, userID).
			Return((*model.Transaction)(nil), service.ErrTransactionAccessDenied).Once()

		req := authedReq("DELETE", transactionPathWithID(transactionID), nil, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.DeleteTransaction, req)
		assert.Equal(t, http.StatusForbidden, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("get error", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransaction", mock.Anything, transactionID, userID).
			Return((*model.Transaction)(nil), fmt.Errorf("fail")).Once()

		req := authedReq("DELETE", transactionPathWithID(transactionID), nil, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.DeleteTransaction, req)
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("delete not found", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransaction", mock.Anything, transactionID, userID).
			Return(transaction, nil).Once()
		mockSvc.On("DeleteTransaction", mock.Anything, transactionID, userID).
			Return(service.ErrTransactionNotFound).Once()

		req := authedReq("DELETE", transactionPathWithID(transactionID), nil, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.DeleteTransaction, req)
		assert.Equal(t, http.StatusNotFound, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("delete access denied", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransaction", mock.Anything, transactionID, userID).
			Return(transaction, nil).Once()
		mockSvc.On("DeleteTransaction", mock.Anything, transactionID, userID).
			Return(service.ErrTransactionAccessDenied).Once()

		req := authedReq("DELETE", transactionPathWithID(transactionID), nil, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.DeleteTransaction, req)
		assert.Equal(t, http.StatusForbidden, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("delete error", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransaction", mock.Anything, transactionID, userID).
			Return(transaction, nil).Once()
		mockSvc.On("DeleteTransaction", mock.Anything, transactionID, userID).
			Return(fmt.Errorf("fail")).Once()

		req := authedReq("DELETE", transactionPathWithID(transactionID), nil, userID)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.DeleteTransaction, req)
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run(invalidUUIDCaseName, func(t *testing.T) {
		req := authedReq("DELETE", transactionPathWithPrefix+invalidUUIDValue, nil, userID)
		req.SetPathValue("id", invalidUUIDValue)
		resp := perform(handler.DeleteTransaction, req)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run(noUserIDCaseName, func(t *testing.T) {
		req := rawReq("DELETE", transactionPathWithID(transactionID), nil)
		req.SetPathValue("id", transactionID.String())
		resp := perform(handler.DeleteTransaction, req)
		assert.Equal(t, http.StatusUnauthorized, resp.Code)
	})
}

func TestTransactionHandlerSetupRoutes(t *testing.T) {
	handler, _ := setupTransactionHandler(t)
	r := router.NewRouter()

	handler.SetupRoutes(r)
}

func TestConvertTransactionAggregations(t *testing.T) {
	t.Run("nil result returns nil", func(t *testing.T) {
		assert.Nil(t, convertTransactionAggregations(nil))
	})

	t.Run("empty aggregations return nil", func(t *testing.T) {
		result := &service.GetTransactionsResult{}
		assert.Nil(t, convertTransactionAggregations(result))
	})

	t.Run("populates all aggregation buckets", func(t *testing.T) {
		result := &service.GetTransactionsResult{
			TypeAggregations: map[string]util.AggregationResult{
				"EXPENSE": {Count: 2, Sum: 200},
			},
			CurrencyAggregations: map[string]util.AggregationResult{
				"USD": {Count: 3, Sum: 300},
			},
			AccountAggregations: map[string]util.AggregationResult{
				"Bank": {Count: 4, Sum: 400},
			},
			CategoryAggregations: map[string]util.AggregationResult{
				"Food": {Count: 5, Sum: 500},
			},
		}

		got := convertTransactionAggregations(result)
		require.NotNil(t, got)
		assert.Len(t, *got, 4)

		typeBuckets, ok := (*got)["type"]
		require.True(t, ok)
		assert.Len(t, typeBuckets, 1)
		assert.Equal(t, "EXPENSE", typeBuckets[0].Key)

		currencyBuckets, ok := (*got)["currency"]
		require.True(t, ok)
		assert.Len(t, currencyBuckets, 1)
		assert.Equal(t, "USD", currencyBuckets[0].Key)

		accountBuckets, ok := (*got)["account"]
		require.True(t, ok)
		assert.Len(t, accountBuckets, 1)
		assert.Equal(t, "Bank", accountBuckets[0].Key)

		categoryBuckets, ok := (*got)["category"]
		require.True(t, ok)
		assert.Len(t, categoryBuckets, 1)
		assert.Equal(t, "Food", categoryBuckets[0].Key)
	})

	t.Run("partial aggregations", func(t *testing.T) {
		result := &service.GetTransactionsResult{
			TypeAggregations: map[string]util.AggregationResult{
				"INCOME": {Count: 1, Sum: 100},
			},
		}

		got := convertTransactionAggregations(result)
		require.NotNil(t, got)
		assert.Len(t, *got, 1)
	})
}

/* -------------------- Asset Service Mock & Handler -------------------- */

type MockAssetService struct{ mock.Mock }

func (m *MockAssetService) CreateAsset(ctx context.Context, asset *model.Asset) (*model.Asset, error) {
	args := m.Called(ctx, asset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockAssetService) GetAsset(ctx context.Context, id, userID uuid.UUID) (*model.Asset, error) {
	args := m.Called(ctx, id, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockAssetService) GetAssets(ctx context.Context, params service.GetAssetsParams) (*service.GetAssetsResult, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.GetAssetsResult), args.Error(1)
}

func (m *MockAssetService) UpdateAsset(ctx context.Context, id uuid.UUID, input service.UpdateAssetInput, userID uuid.UUID) (*model.Asset, error) {
	args := m.Called(ctx, id, input, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockAssetService) DeleteAsset(ctx context.Context, id, userID uuid.UUID) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func setupAssetHandler(t *testing.T) (*AssetHandler, *MockAssetService) {
	mockSvc := new(MockAssetService)
	mockOIDC := &client.OIDCClient{}
	return NewAssetHandler(mockOIDC, mockSvc), mockSvc
}

const (
	assetPath             = "/asset"
	assetPathWithIDPrefix = "/asset/"
	assetsPath            = "/assets"
	assetTypesPath        = "/asset/types"
)

func assetPathWithID(id uuid.UUID) string {
	return assetPathWithIDPrefix + id.String()
}

/* ------------------------ Asset Handler Tests ------------------------ */

func TestAssetHandlerCreateAsset(t *testing.T) {
	handler, mockSvc := setupAssetHandler(t)
	userID := uuid.New()

	okReq := CreateAssetRequest{
		Name:     "Test Stock",
		Type:     model.AssetTypeStock,
		Value:    1000.0,
		Currency: "USD",
	}
	okAsset := &model.Asset{
		ID:       uuid.New(),
		Name:     okReq.Name,
		Type:     okReq.Type,
		Value:    okReq.Value,
		Currency: okReq.Currency,
		UserID:   userID,
	}

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name: "success",
			req:  authedReq("POST", assetPath, okReq, userID),
			mockSetup: func() {
				mockSvc.
					On("CreateAsset", mock.Anything, mock.AnythingOfType("*model.Asset")).
					Return(okAsset, nil).Once()
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "invalid type",
			req:  authedReq("POST", assetPath, CreateAssetRequest{Name: "A", Type: "INVALID", Value: 10, Currency: "USD"}, userID),
			mockSetup: func() {
				mockSvc.
					On("CreateAsset", mock.Anything, mock.AnythingOfType("*model.Asset")).
					Return(nil, service.ErrInvalidAssetType).Once()
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: invalidJSONBody,
			req: func() *http.Request {
				return authedReq("POST", assetPath, nil, userID).WithContext(authedReq("POST", assetPath, nil, userID).Context())
			}(),
			mockSetup:  func() {},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: serviceErrorCaseName,
			req:  authedReq("POST", assetPath, okReq, userID),
			mockSetup: func() {
				mockSvc.
					On("CreateAsset", mock.Anything, mock.AnythingOfType("*model.Asset")).
					Return(nil, fmt.Errorf(serviceErrorCaseName)).Once()
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name: noUserIDCaseName,
			req:  httptest.NewRequest("POST", assetPath, bytes.NewBufferString("{}")),
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "CreateAsset")
			},
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()
			w := perform(handler.CreateAsset, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestAssetHandlerGetAsset(t *testing.T) {
	handler, mockSvc := setupAssetHandler(t)
	userID := uuid.New()
	assetID := uuid.New()

	okAsset := &model.Asset{
		ID:       assetID,
		Name:     "Test Stock",
		Type:     model.AssetTypeStock,
		Value:    1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	req := authedReq("GET", assetPathWithID(assetID), nil, userID)
	req.SetPathValue("id", assetID.String())

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name:       "success",
			req:        req,
			wantStatus: http.StatusOK,
			mockSetup: func() {
				mockSvc.
					On("GetAsset", mock.Anything, assetID, userID).
					Return(okAsset, nil).Once()
			},
		},
		{
			name:       "not found",
			req:        req,
			wantStatus: http.StatusNotFound,
			mockSetup: func() {
				mockSvc.
					On("GetAsset", mock.Anything, assetID, userID).
					Return(nil, service.ErrAssetNotFound).Once()
			},
		},
		{
			name: "invalid uuid",
			req: func() *http.Request {
				r := authedReq("GET", "/asset/invalid-uuid", nil, userID)
				r.SetPathValue("id", "invalid-uuid")
				return r
			}(),
			wantStatus: http.StatusBadRequest,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "GetAsset")
			},
		},
		{
			name:       "service error",
			req:        req,
			wantStatus: http.StatusInternalServerError,
			mockSetup: func() {
				mockSvc.
					On("GetAsset", mock.Anything, assetID, userID).
					Return(nil, fmt.Errorf("db error")).Once()
			},
		},
		{
			name: noUserIDCaseName,
			req: func() *http.Request {
				r := httptest.NewRequest("GET", assetPathWithID(assetID), nil)
				r.SetPathValue("id", assetID.String())
				return r
			}(),
			wantStatus: http.StatusUnauthorized,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "GetAsset")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()
			w := perform(handler.GetAsset, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestAssetHandlerGetAssets(t *testing.T) {
	handler, mockSvc := setupAssetHandler(t)
	userID := uuid.New()

	okResult := &service.GetAssetsResult{
		Assets: []*model.Asset{
			{ID: uuid.New(), Name: "Stock 1", Type: model.AssetTypeStock, Value: 1000, UserID: userID, Currency: "USD"},
		},
		Total: 1,
	}

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name:       "success with pagination",
			req:        authedReq("GET", "/assets?page=2&limit=50", nil, userID),
			wantStatus: http.StatusOK,
			mockSetup: func() {
				mockSvc.
					On("GetAssets", mock.Anything, mock.AnythingOfType("service.GetAssetsParams")).
					Return(okResult, nil).Once()
			},
		},
		{
			name:       "success with filters",
			req:        authedReq("GET", "/assets?type=STOCK&type=CRYPTO&currency=USD", nil, userID),
			wantStatus: http.StatusOK,
			mockSetup: func() {
				mockSvc.
					On("GetAssets", mock.Anything, mock.Anything).
					Return(okResult, nil).Once()
			},
		},
		{
			name:       "service error",
			req:        authedReq("GET", assetsPath, nil, userID),
			wantStatus: http.StatusInternalServerError,
			mockSetup: func() {
				mockSvc.
					On("GetAssets", mock.Anything, mock.Anything).
					Return(nil, fmt.Errorf("db error")).Once()
			},
		},
		{
			name:       noUserIDCaseName,
			req:        httptest.NewRequest("GET", assetsPath, nil),
			wantStatus: http.StatusUnauthorized,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "GetAssets")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()
			w := perform(handler.GetAssets, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestAssetHandlerUpdateAsset(t *testing.T) {
	handler, mockSvc := setupAssetHandler(t)
	userID := uuid.New()
	assetID := uuid.New()

	updatedAsset := &model.Asset{
		ID:       assetID,
		Name:     "Updated Stock",
		Type:     model.AssetTypeStock,
		Value:    1500.0,
		Currency: "USD",
		UserID:   userID,
	}

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name: "success",
			req: func() *http.Request {
				r := authedReq("PUT", assetPathWithID(assetID), UpdateAssetRequest{Name: stringPtr("Updated Stock")}, userID)
				r.SetPathValue("id", assetID.String())
				return r
			}(),
			wantStatus: http.StatusOK,
			mockSetup: func() {
				mockSvc.
					On("UpdateAsset", mock.Anything, assetID, mock.Anything, userID).
					Return(updatedAsset, nil).Once()
			},
		},
		{
			name: "not found",
			req: func() *http.Request {
				r := authedReq("PUT", assetPathWithID(assetID), UpdateAssetRequest{}, userID)
				r.SetPathValue("id", assetID.String())
				return r
			}(),
			wantStatus: http.StatusNotFound,
			mockSetup: func() {
				mockSvc.
					On("UpdateAsset", mock.Anything, assetID, mock.Anything, userID).
					Return(nil, service.ErrAssetNotFound).Once()
			},
		},
		{
			name: invalidJSONBody,
			req: func() *http.Request {
				r := httptest.NewRequest("PUT", assetPathWithID(assetID), bytes.NewBufferString(invalidJSONBody))
				r.Header.Set("Content-Type", "application/json")
				ctx := context.WithValue(r.Context(), util.UserIDKey, userID.String())
				r = r.WithContext(ctx)
				r.SetPathValue("id", assetID.String())
				return r
			}(),
			wantStatus: http.StatusBadRequest,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "UpdateAsset")
			},
		},
		{
			name: noUserIDCaseName,
			req: func() *http.Request {
				r := httptest.NewRequest("PUT", assetPathWithID(assetID), bytes.NewBufferString("{}"))
				r.SetPathValue("id", assetID.String())
				return r
			}(),
			wantStatus: http.StatusUnauthorized,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "UpdateAsset")
			},
		},
		{
			name: invalidJSONBody,
			req: func() *http.Request {
				r := httptest.NewRequest("PUT", assetPathWithID(assetID), bytes.NewBufferString(invalidJSONBody))
				r.Header.Set("Content-Type", "application/json")
				ctx := context.WithValue(r.Context(), util.UserIDKey, userID.String())
				r = r.WithContext(ctx)
				r.SetPathValue("id", assetID.String())
				return r
			}(),
			wantStatus: http.StatusBadRequest,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "UpdateAsset")
			},
		},
		{
			name: serviceErrorCaseName,
			req: func() *http.Request {
				r := authedReq("PUT", assetPathWithID(assetID), UpdateAssetRequest{}, userID)
				r.SetPathValue("id", assetID.String())
				return r
			}(),
			wantStatus: http.StatusInternalServerError,
			mockSetup: func() {
				mockSvc.
					On("UpdateAsset", mock.Anything, assetID, mock.Anything, userID).
					Return(nil, fmt.Errorf("database error")).Once()
			},
		},
		{
			name: "generic service error (not not found)",
			req: func() *http.Request {
				r := authedReq("PUT", assetPathWithID(assetID), UpdateAssetRequest{}, userID)
				r.SetPathValue("id", assetID.String())
				return r
			}(),
			wantStatus: http.StatusInternalServerError,
			mockSetup: func() {
				mockSvc.
					On("UpdateAsset", mock.Anything, assetID, mock.Anything, userID).
					Return(nil, errors.New("unexpected error")).Once()
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()
			w := perform(handler.UpdateAsset, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestAssetHandlerDeleteAsset(t *testing.T) {
	handler, mockSvc := setupAssetHandler(t)
	userID := uuid.New()
	assetID := uuid.New()

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name: "success",
			req: func() *http.Request {
				r := authedReq("DELETE", assetPathWithID(assetID), nil, userID)
				r.SetPathValue("id", assetID.String())
				return r
			}(),
			wantStatus: http.StatusOK,
			mockSetup: func() {
				mockSvc.
					On("DeleteAsset", mock.Anything, assetID, userID).
					Return(nil).Once()
			},
		},
		{
			name: "not found",
			req: func() *http.Request {
				r := authedReq("DELETE", assetPathWithID(assetID), nil, userID)
				r.SetPathValue("id", assetID.String())
				return r
			}(),
			wantStatus: http.StatusNotFound,
			mockSetup: func() {
				mockSvc.
					On("DeleteAsset", mock.Anything, assetID, userID).
					Return(service.ErrAssetNotFound).Once()
			},
		},
		{
			name: "service error",
			req: func() *http.Request {
				r := authedReq("DELETE", assetPathWithID(assetID), nil, userID)
				r.SetPathValue("id", assetID.String())
				return r
			}(),
			wantStatus: http.StatusInternalServerError,
			mockSetup: func() {
				mockSvc.
					On("DeleteAsset", mock.Anything, assetID, userID).
					Return(fmt.Errorf("service error")).Once()
			},
		},
		{
			name: "invalid uuid",
			req: func() *http.Request {
				r := authedReq("DELETE", "/asset/invalid-uuid", nil, userID)
				r.SetPathValue("id", "invalid-uuid")
				return r
			}(),
			wantStatus: http.StatusBadRequest,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "DeleteAsset")
			},
		},
		{
			name: noUserIDCaseName,
			req: func() *http.Request {
				r := httptest.NewRequest("DELETE", assetPathWithID(assetID), nil)
				r.SetPathValue("id", assetID.String())
				return r
			}(),
			wantStatus: http.StatusUnauthorized,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "DeleteAsset")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()
			w := perform(handler.DeleteAsset, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestAssetHandlerGetAssetTypes(t *testing.T) {
	handler, _ := setupAssetHandler(t)
	userID := uuid.New()

	req := authedReq("GET", assetTypesPath, nil, userID)
	w := perform(handler.GetAssetTypes, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "STOCK")
	assert.Contains(t, w.Body.String(), "CRYPTO")
}

func TestAssetHandlerSetupRoutes(t *testing.T) {
	handler, _ := setupAssetHandler(t)
	r := router.NewRouter()
	assert.NotPanics(t, func() { handler.SetupRoutes(r) })
}

/* ------------------- Liability Service Mock & Handler ------------------- */

type MockLiabilityService struct{ mock.Mock }

func (m *MockLiabilityService) CreateLiability(ctx context.Context, liability *model.Liability) (*model.Liability, error) {
	args := m.Called(ctx, liability)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Liability), args.Error(1)
}

func (m *MockLiabilityService) GetLiability(ctx context.Context, id, userID uuid.UUID) (*model.Liability, error) {
	args := m.Called(ctx, id, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Liability), args.Error(1)
}

func (m *MockLiabilityService) GetLiabilities(ctx context.Context, params service.GetLiabilitiesParams) (*service.GetLiabilitiesResult, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.GetLiabilitiesResult), args.Error(1)
}

func (m *MockLiabilityService) UpdateLiability(ctx context.Context, id uuid.UUID, input service.UpdateLiabilityInput, userID uuid.UUID) (*model.Liability, error) {
	args := m.Called(ctx, id, input, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Liability), args.Error(1)
}

func (m *MockLiabilityService) DeleteLiability(ctx context.Context, id, userID uuid.UUID) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func setupLiabilityHandler(t *testing.T) (*LiabilityHandler, *MockLiabilityService) {
	mockSvc := new(MockLiabilityService)
	mockOIDC := &client.OIDCClient{}
	return NewLiabilityHandler(mockOIDC, mockSvc), mockSvc
}

const (
	liabilityPath             = "/liability"
	liabilityPathWithIDPrefix = "/liability/"
	liabilitiesPath           = "/liabilities"
	liabilityTypesPath        = "/liability/types"
)

func liabilityPathWithID(id uuid.UUID) string {
	return liabilityPathWithIDPrefix + id.String()
}

/* ----------------------- Liability Handler Tests ---------------------- */

func TestLiabilityHandlerCreateLiability(t *testing.T) {
	handler, mockSvc := setupLiabilityHandler(t)
	userID := uuid.New()

	okReq := CreateLiabilityRequest{
		Name:     "Test Loan",
		Type:     model.LiabilityTypeLoan,
		Amount:   1000.0,
		Currency: "USD",
	}
	okLiability := &model.Liability{
		ID:       uuid.New(),
		Name:     okReq.Name,
		Type:     okReq.Type,
		Amount:   okReq.Amount,
		Currency: okReq.Currency,
		UserID:   userID,
	}

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name: "success",
			req:  authedReq("POST", liabilityPath, okReq, userID),
			mockSetup: func() {
				mockSvc.
					On("CreateLiability", mock.Anything, mock.AnythingOfType("*model.Liability")).
					Return(okLiability, nil).Once()
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "invalid type",
			req:  authedReq("POST", liabilityPath, CreateLiabilityRequest{Name: "A", Type: "INVALID", Amount: 10, Currency: "USD"}, userID),
			mockSetup: func() {
				mockSvc.
					On("CreateLiability", mock.Anything, mock.AnythingOfType("*model.Liability")).
					Return(nil, service.ErrInvalidLiabilityType).Once()
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: invalidJSONBody,
			req: func() *http.Request {
				return authedReq("POST", liabilityPath, nil, userID).WithContext(authedReq("POST", liabilityPath, nil, userID).Context())
			}(),
			mockSetup:  func() {},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: serviceErrorCaseName,
			req:  authedReq("POST", liabilityPath, okReq, userID),
			mockSetup: func() {
				mockSvc.
					On("CreateLiability", mock.Anything, mock.AnythingOfType("*model.Liability")).
					Return(nil, fmt.Errorf(serviceErrorCaseName)).Once()
			},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name: noUserIDCaseName,
			req:  httptest.NewRequest("POST", liabilityPath, bytes.NewBufferString("{}")),
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "CreateLiability")
			},
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()
			w := perform(handler.CreateLiability, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestLiabilityHandlerGetLiability(t *testing.T) {
	handler, mockSvc := setupLiabilityHandler(t)
	userID := uuid.New()
	liabilityID := uuid.New()

	okLiability := &model.Liability{
		ID:       liabilityID,
		Name:     "Test Loan",
		Type:     model.LiabilityTypeLoan,
		Amount:   1000.0,
		Currency: "USD",
		UserID:   userID,
	}

	req := authedReq("GET", liabilityPathWithID(liabilityID), nil, userID)
	req.SetPathValue("id", liabilityID.String())

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name:       "success",
			req:        req,
			wantStatus: http.StatusOK,
			mockSetup: func() {
				mockSvc.
					On("GetLiability", mock.Anything, liabilityID, userID).
					Return(okLiability, nil).Once()
			},
		},
		{
			name:       "not found",
			req:        req,
			wantStatus: http.StatusNotFound,
			mockSetup: func() {
				mockSvc.
					On("GetLiability", mock.Anything, liabilityID, userID).
					Return(nil, service.ErrLiabilityNotFound).Once()
			},
		},
		{
			name: "invalid uuid",
			req: func() *http.Request {
				r := authedReq("GET", "/liability/invalid-uuid", nil, userID)
				r.SetPathValue("id", "invalid-uuid")
				return r
			}(),
			wantStatus: http.StatusBadRequest,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "GetLiability")
			},
		},
		{
			name:       "service error",
			req:        req,
			wantStatus: http.StatusInternalServerError,
			mockSetup: func() {
				mockSvc.
					On("GetLiability", mock.Anything, liabilityID, userID).
					Return(nil, fmt.Errorf("db error")).Once()
			},
		},
		{
			name: noUserIDCaseName,
			req: func() *http.Request {
				r := httptest.NewRequest("GET", liabilityPathWithID(liabilityID), nil)
				r.SetPathValue("id", liabilityID.String())
				return r
			}(),
			wantStatus: http.StatusUnauthorized,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "GetLiability")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()
			w := perform(handler.GetLiability, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestLiabilityHandlerGetLiabilities(t *testing.T) {
	handler, mockSvc := setupLiabilityHandler(t)
	userID := uuid.New()

	okResult := &service.GetLiabilitiesResult{
		Liabilities: []*model.Liability{
			{ID: uuid.New(), Name: "Loan 1", Type: model.LiabilityTypeLoan, Amount: 1000, UserID: userID, Currency: "USD"},
		},
		Total: 1,
	}

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name:       "success with pagination",
			req:        authedReq("GET", "/liabilities?page=2&limit=50", nil, userID),
			wantStatus: http.StatusOK,
			mockSetup: func() {
				mockSvc.
					On("GetLiabilities", mock.Anything, mock.AnythingOfType("service.GetLiabilitiesParams")).
					Return(okResult, nil).Once()
			},
		},
		{
			name:       "success with filters",
			req:        authedReq("GET", "/liabilities?type=LOAN&type=MORTGAGE&currency=USD", nil, userID),
			wantStatus: http.StatusOK,
			mockSetup: func() {
				mockSvc.
					On("GetLiabilities", mock.Anything, mock.Anything).
					Return(okResult, nil).Once()
			},
		},
		{
			name:       "service error",
			req:        authedReq("GET", liabilitiesPath, nil, userID),
			wantStatus: http.StatusInternalServerError,
			mockSetup: func() {
				mockSvc.
					On("GetLiabilities", mock.Anything, mock.Anything).
					Return(nil, fmt.Errorf("db error")).Once()
			},
		},
		{
			name:       noUserIDCaseName,
			req:        httptest.NewRequest("GET", liabilitiesPath, nil),
			wantStatus: http.StatusUnauthorized,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "GetLiabilities")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()
			w := perform(handler.GetLiabilities, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestLiabilityHandlerUpdateLiability(t *testing.T) {
	handler, mockSvc := setupLiabilityHandler(t)
	userID := uuid.New()
	liabilityID := uuid.New()

	updatedLiability := &model.Liability{
		ID:       liabilityID,
		Name:     "Updated Loan",
		Type:     model.LiabilityTypeLoan,
		Amount:   1500.0,
		Currency: "USD",
		UserID:   userID,
	}

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name: "success",
			req: func() *http.Request {
				r := authedReq("PUT", liabilityPathWithID(liabilityID), UpdateLiabilityRequest{Amount: float64Ptr(1500.0)}, userID)
				r.SetPathValue("id", liabilityID.String())
				return r
			}(),
			wantStatus: http.StatusOK,
			mockSetup: func() {
				mockSvc.
					On("UpdateLiability", mock.Anything, liabilityID, mock.Anything, userID).
					Return(updatedLiability, nil).Once()
			},
		},
		{
			name: "not found",
			req: func() *http.Request {
				r := authedReq("PUT", liabilityPathWithID(liabilityID), UpdateLiabilityRequest{}, userID)
				r.SetPathValue("id", liabilityID.String())
				return r
			}(),
			wantStatus: http.StatusNotFound,
			mockSetup: func() {
				mockSvc.
					On("UpdateLiability", mock.Anything, liabilityID, mock.Anything, userID).
					Return(nil, service.ErrLiabilityNotFound).Once()
			},
		},
		{
			name: "service error",
			req: func() *http.Request {
				r := authedReq("PUT", liabilityPathWithID(liabilityID), UpdateLiabilityRequest{}, userID)
				r.SetPathValue("id", liabilityID.String())
				return r
			}(),
			wantStatus: http.StatusInternalServerError,
			mockSetup: func() {
				mockSvc.
					On("UpdateLiability", mock.Anything, liabilityID, mock.Anything, userID).
					Return(nil, fmt.Errorf("service error")).Once()
			},
		},
		{
			name: "generic service error (not not found)",
			req: func() *http.Request {
				r := authedReq("PUT", liabilityPathWithID(liabilityID), UpdateLiabilityRequest{}, userID)
				r.SetPathValue("id", liabilityID.String())
				return r
			}(),
			wantStatus: http.StatusInternalServerError,
			mockSetup: func() {
				mockSvc.
					On("UpdateLiability", mock.Anything, liabilityID, mock.Anything, userID).
					Return(nil, errors.New("unexpected error")).Once()
			},
		},
		{
			name: "invalid json",
			req: func() *http.Request {
				r := authedReq("PUT", liabilityPathWithID(liabilityID), nil, userID)
				r.SetPathValue("id", liabilityID.String())
				return r.WithContext(authedReq("PUT", liabilityPathWithID(liabilityID), nil, userID).Context())
			}(),
			wantStatus: http.StatusBadRequest,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "UpdateLiability")
			},
		},
		{
			name: noUserIDCaseName,
			req: func() *http.Request {
				r := httptest.NewRequest("PUT", liabilityPathWithID(liabilityID), bytes.NewBufferString("{}"))
				r.SetPathValue("id", liabilityID.String())
				return r
			}(),
			wantStatus: http.StatusUnauthorized,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "UpdateLiability")
			},
		},
		{
			name: invalidJSONBody,
			req: func() *http.Request {
				r := httptest.NewRequest("PUT", liabilityPathWithID(liabilityID), bytes.NewBufferString(invalidJSONBody))
				r.Header.Set("Content-Type", "application/json")
				ctx := context.WithValue(r.Context(), util.UserIDKey, userID.String())
				r = r.WithContext(ctx)
				r.SetPathValue("id", liabilityID.String())
				return r
			}(),
			wantStatus: http.StatusBadRequest,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "UpdateLiability")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()
			w := perform(handler.UpdateLiability, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestLiabilityHandlerDeleteLiability(t *testing.T) {
	handler, mockSvc := setupLiabilityHandler(t)
	userID := uuid.New()
	liabilityID := uuid.New()

	tests := []struct {
		name       string
		req        *http.Request
		mockSetup  func()
		wantStatus int
	}{
		{
			name: "success",
			req: func() *http.Request {
				r := authedReq("DELETE", liabilityPathWithID(liabilityID), nil, userID)
				r.SetPathValue("id", liabilityID.String())
				return r
			}(),
			wantStatus: http.StatusOK,
			mockSetup: func() {
				mockSvc.
					On("DeleteLiability", mock.Anything, liabilityID, userID).
					Return(nil).Once()
			},
		},
		{
			name: "not found",
			req: func() *http.Request {
				r := authedReq("DELETE", liabilityPathWithID(liabilityID), nil, userID)
				r.SetPathValue("id", liabilityID.String())
				return r
			}(),
			wantStatus: http.StatusNotFound,
			mockSetup: func() {
				mockSvc.
					On("DeleteLiability", mock.Anything, liabilityID, userID).
					Return(service.ErrLiabilityNotFound).Once()
			},
		},
		{
			name: "service error",
			req: func() *http.Request {
				r := authedReq("DELETE", liabilityPathWithID(liabilityID), nil, userID)
				r.SetPathValue("id", liabilityID.String())
				return r
			}(),
			wantStatus: http.StatusInternalServerError,
			mockSetup: func() {
				mockSvc.
					On("DeleteLiability", mock.Anything, liabilityID, userID).
					Return(fmt.Errorf("service error")).Once()
			},
		},
		{
			name: "invalid uuid",
			req: func() *http.Request {
				r := authedReq("DELETE", "/liability/invalid-uuid", nil, userID)
				r.SetPathValue("id", "invalid-uuid")
				return r
			}(),
			wantStatus: http.StatusBadRequest,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "DeleteLiability")
			},
		},
		{
			name: noUserIDCaseName,
			req: func() *http.Request {
				r := httptest.NewRequest("DELETE", liabilityPathWithID(liabilityID), nil)
				r.SetPathValue("id", liabilityID.String())
				return r
			}(),
			wantStatus: http.StatusUnauthorized,
			mockSetup: func() {
				mockSvc.AssertNotCalled(t, "DeleteLiability")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()
			w := perform(handler.DeleteLiability, tt.req)
			assert.Equal(t, tt.wantStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestLiabilityHandlerGetLiabilityTypes(t *testing.T) {
	handler, _ := setupLiabilityHandler(t)
	userID := uuid.New()

	req := authedReq("GET", liabilityTypesPath, nil, userID)
	w := perform(handler.GetLiabilityTypes, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "LOAN")
	assert.Contains(t, w.Body.String(), "MORTGAGE")
}

func TestLiabilityHandlerSetupRoutes(t *testing.T) {
	handler, _ := setupLiabilityHandler(t)
	r := router.NewRouter()
	assert.NotPanics(t, func() { handler.SetupRoutes(r) })
}

/* -------------------- Dashboard Service Mock & Handler -------------------- */

type MockDashboardService struct{ mock.Mock }

func (m *MockDashboardService) GetSummary(ctx context.Context, params service.SummaryParams) (*service.SummaryResult, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.SummaryResult), args.Error(1)
}

func (m *MockDashboardService) GetAccountAggregations(ctx context.Context, userID uuid.UUID) (*service.AccountAggregationsResult, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.AccountAggregationsResult), args.Error(1)
}

func (m *MockDashboardService) GetBudgetPerformance(ctx context.Context, userID uuid.UUID, month, year int) (*service.BudgetPerformanceResult, error) {
	args := m.Called(ctx, userID, month, year)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.BudgetPerformanceResult), args.Error(1)
}

func (m *MockDashboardService) GetTransactionTrends(ctx context.Context, userID uuid.UUID, startDate, endDate time.Time, granularity string) (*service.TransactionTrendsResult, error) {
	args := m.Called(ctx, userID, startDate, endDate, granularity)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.TransactionTrendsResult), args.Error(1)
}

func (m *MockDashboardService) GetExpenseBreakdown(ctx context.Context, userID uuid.UUID, startDate, endDate time.Time) (*service.ExpenseBreakdownResult, error) {
	args := m.Called(ctx, userID, startDate, endDate)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.ExpenseBreakdownResult), args.Error(1)
}

func setupDashboardHandler(t *testing.T) (*DashboardHandler, *MockDashboardService) {
	mockSvc := new(MockDashboardService)
	mockOIDC := &client.OIDCClient{}
	return NewDashboardHandler(mockOIDC, mockSvc), mockSvc
}

const (
	dashboardSummaryPath           = "/dashboard/summary"
	dashboardAccountsPath          = "/dashboard/accounts"
	dashboardBudgetPerformancePath = "/dashboard/budget-performance"
	dashboardTransactionTrendsPath = "/dashboard/transaction-trends"
	dashboardExpenseBreakdownPath  = "/dashboard/expense-breakdown"
)

/* ----------------------- Dashboard Handler Tests ----------------------- */

func TestDashboardHandlerNewDashboardHandler(t *testing.T) {
	mockSvc := new(MockDashboardService)
	oidc := &client.OIDCClient{}
	h := NewDashboardHandler(oidc, mockSvc)
	assert.NotNil(t, h)
	assert.Equal(t, oidc, h.oidcClient)
	assert.Equal(t, mockSvc, h.dashboardService)
}

func TestDashboardHandlerSetupRoutes(t *testing.T) {
	handler, _ := setupDashboardHandler(t)
	r := router.NewRouter()
	assert.NotPanics(t, func() { handler.SetupRoutes(r) })
}

func TestDashboardHandlerGetDashboardSummary(t *testing.T) {
	handler, mockSvc := setupDashboardHandler(t)
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockSvc.On("GetSummary", mock.Anything, mock.AnythingOfType("service.SummaryParams")).
			Return(&service.SummaryResult{}, nil).Once()

		req := authedReq("GET", dashboardSummaryPath, nil, userID)
		resp := perform(handler.GetDashboardSummary, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("with date range", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetSummary", mock.Anything, mock.AnythingOfType("service.SummaryParams")).
			Return(&service.SummaryResult{}, nil).Once()

		req := authedReq("GET", "/dashboard/summary?start_date=2024-01-01&end_date=2024-12-31", nil, userID)
		resp := perform(handler.GetDashboardSummary, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("service error", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetSummary", mock.Anything, mock.AnythingOfType("service.SummaryParams")).
			Return(nil, fmt.Errorf("fail")).Once()

		req := authedReq("GET", dashboardSummaryPath, nil, userID)
		resp := perform(handler.GetDashboardSummary, req)
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("no user id", func(t *testing.T) {
		req := httptest.NewRequest("GET", dashboardSummaryPath, nil)
		resp := perform(handler.GetDashboardSummary, req)
		assert.Equal(t, http.StatusUnauthorized, resp.Code)
	})
}

func TestDashboardHandlerGetAccountAggregations(t *testing.T) {
	handler, mockSvc := setupDashboardHandler(t)
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockSvc.On("GetAccountAggregations", mock.Anything, userID).
			Return(&service.AccountAggregationsResult{}, nil).Once()

		req := authedReq("GET", dashboardAccountsPath, nil, userID)
		resp := perform(handler.GetAccountAggregations, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("service error", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetAccountAggregations", mock.Anything, userID).
			Return(nil, fmt.Errorf("fail")).Once()

		req := authedReq("GET", dashboardAccountsPath, nil, userID)
		resp := perform(handler.GetAccountAggregations, req)
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("no user id", func(t *testing.T) {
		req := httptest.NewRequest("GET", dashboardAccountsPath, nil)
		resp := perform(handler.GetAccountAggregations, req)
		assert.Equal(t, http.StatusUnauthorized, resp.Code)
	})
}

func TestDashboardHandlerGetBudgetPerformance(t *testing.T) {
	handler, mockSvc := setupDashboardHandler(t)
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockSvc.On("GetBudgetPerformance", mock.Anything, userID, mock.AnythingOfType("int"), mock.AnythingOfType("int")).
			Return(&service.BudgetPerformanceResult{}, nil).Once()

		req := authedReq("GET", dashboardBudgetPerformancePath+"?month=1&year=2024", nil, userID)
		resp := perform(handler.GetBudgetPerformance, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("with default date", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetBudgetPerformance", mock.Anything, userID, mock.AnythingOfType("int"), mock.AnythingOfType("int")).
			Return(&service.BudgetPerformanceResult{}, nil).Once()

		req := authedReq("GET", dashboardBudgetPerformancePath, nil, userID)
		resp := perform(handler.GetBudgetPerformance, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("service error", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetBudgetPerformance", mock.Anything, userID, mock.AnythingOfType("int"), mock.AnythingOfType("int")).
			Return(nil, fmt.Errorf("fail")).Once()

		req := authedReq("GET", dashboardBudgetPerformancePath, nil, userID)
		resp := perform(handler.GetBudgetPerformance, req)
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("no user id", func(t *testing.T) {
		req := httptest.NewRequest("GET", dashboardBudgetPerformancePath, nil)
		resp := perform(handler.GetBudgetPerformance, req)
		assert.Equal(t, http.StatusUnauthorized, resp.Code)
	})
}

func TestDashboardHandlerGetTransactionTrends(t *testing.T) {
	handler, mockSvc := setupDashboardHandler(t)
	userID := uuid.New()

	t.Run("success with date range", func(t *testing.T) {
		mockSvc.On("GetTransactionTrends", mock.Anything, userID, mock.AnythingOfType("time.Time"), mock.AnythingOfType("time.Time"), mock.AnythingOfType("string")).
			Return(&service.TransactionTrendsResult{}, nil).Once()

		req := authedReq("GET", "/dashboard/transaction-trends?start_date=2024-01-01&end_date=2024-12-31&granularity=month", nil, userID)
		resp := perform(handler.GetTransactionTrends, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("success with default dates", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransactionTrends", mock.Anything, userID, mock.AnythingOfType("time.Time"), mock.AnythingOfType("time.Time"), mock.AnythingOfType("string")).
			Return(&service.TransactionTrendsResult{}, nil).Once()

		req := authedReq("GET", dashboardTransactionTrendsPath, nil, userID)
		resp := perform(handler.GetTransactionTrends, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("invalid start date format", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		req := authedReq("GET", "/dashboard/transaction-trends?start_date=invalid", nil, userID)
		resp := perform(handler.GetTransactionTrends, req)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("invalid end date format", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		req := authedReq("GET", "/dashboard/transaction-trends?end_date=invalid", nil, userID)
		resp := perform(handler.GetTransactionTrends, req)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("service error", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetTransactionTrends", mock.Anything, userID, mock.AnythingOfType("time.Time"), mock.AnythingOfType("time.Time"), mock.AnythingOfType("string")).
			Return(nil, fmt.Errorf("fail")).Once()

		req := authedReq("GET", dashboardTransactionTrendsPath, nil, userID)
		resp := perform(handler.GetTransactionTrends, req)
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("no user id", func(t *testing.T) {
		req := httptest.NewRequest("GET", dashboardTransactionTrendsPath, nil)
		resp := perform(handler.GetTransactionTrends, req)
		assert.Equal(t, http.StatusUnauthorized, resp.Code)
	})
}

func TestDashboardHandlerGetExpenseBreakdown(t *testing.T) {
	handler, mockSvc := setupDashboardHandler(t)
	userID := uuid.New()

	t.Run("success with date range", func(t *testing.T) {
		mockSvc.On("GetExpenseBreakdown", mock.Anything, userID, mock.AnythingOfType("time.Time"), mock.AnythingOfType("time.Time")).
			Return(&service.ExpenseBreakdownResult{}, nil).Once()

		req := authedReq("GET", "/dashboard/expense-breakdown?start_date=2024-01-01&end_date=2024-12-31", nil, userID)
		resp := perform(handler.GetExpenseBreakdown, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("success with default dates", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetExpenseBreakdown", mock.Anything, userID, mock.AnythingOfType("time.Time"), mock.AnythingOfType("time.Time")).
			Return(&service.ExpenseBreakdownResult{}, nil).Once()

		req := authedReq("GET", dashboardExpenseBreakdownPath, nil, userID)
		resp := perform(handler.GetExpenseBreakdown, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("invalid start date format", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		req := authedReq("GET", "/dashboard/expense-breakdown?start_date=invalid", nil, userID)
		resp := perform(handler.GetExpenseBreakdown, req)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("invalid end date format", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		req := authedReq("GET", "/dashboard/expense-breakdown?end_date=invalid", nil, userID)
		resp := perform(handler.GetExpenseBreakdown, req)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("service error", func(t *testing.T) {
		mockSvc.ExpectedCalls = nil
		mockSvc.Calls = nil
		mockSvc.On("GetExpenseBreakdown", mock.Anything, userID, mock.AnythingOfType("time.Time"), mock.AnythingOfType("time.Time")).
			Return(nil, fmt.Errorf("fail")).Once()

		req := authedReq("GET", dashboardExpenseBreakdownPath, nil, userID)
		resp := perform(handler.GetExpenseBreakdown, req)
		assert.Equal(t, http.StatusInternalServerError, resp.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("no user id", func(t *testing.T) {
		req := httptest.NewRequest("GET", dashboardExpenseBreakdownPath, nil)
		resp := perform(handler.GetExpenseBreakdown, req)
		assert.Equal(t, http.StatusUnauthorized, resp.Code)
	})
}
