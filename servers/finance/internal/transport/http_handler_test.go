package handler

import (
	"bytes"
	"context"
	"encoding/json"
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
