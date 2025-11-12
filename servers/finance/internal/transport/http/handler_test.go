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
func (m *MockAccountService) UpdateAccount(ctx context.Context, id uuid.UUID, name, currency, notes *string, balance *float64, isDeleted *bool, userID uuid.UUID) (*model.Account, error) {
	args := m.Called(ctx, id, name, currency, notes, balance, isDeleted, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Account), args.Error(1)
}

func setupHandler(t *testing.T) (*AccountHandler, *MockAccountService) {
	mockSvc := new(MockAccountService)
	mockOIDC := &client.OIDCClient{}
	return NewAccountHandler(mockOIDC, mockSvc), mockSvc
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
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID.String())
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
				ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID.String())
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
			if tt.req.Context().Value(middleware.UserIDKey) != nil {
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
					Return(nil, service.ErrAccessDenied).Once()
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
				mockSvc.
					On("UpdateAccount", mock.Anything, accountID, body.Name, body.Currency, body.Notes, body.Balance, body.IsDeleted, userID).
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
				ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID.String())
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
				mockSvc.
					On("UpdateAccount", mock.Anything, accountID, body.Name, body.Currency, body.Notes, body.Balance, body.IsDeleted, userID).
					Return(nil, service.ErrAccountNotFound).Once()
			},
			wantStatus: http.StatusNotFound,
		},
		{
			name: "access denied",
			req:  authedReq("PUT", accountPathWithID(accountID), body, userID),
			setup: func() {
				mockSvc.
					On("UpdateAccount", mock.Anything, accountID, body.Name, body.Currency, body.Notes, body.Balance, body.IsDeleted, userID).
					Return(nil, service.ErrAccessDenied).Once()
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name: serviceErrorCaseName,
			req:  authedReq("PUT", accountPathWithID(accountID), body, userID),
			setup: func() {
				mockSvc.
					On("UpdateAccount", mock.Anything, accountID, body.Name, body.Currency, body.Notes, body.Balance, body.IsDeleted, userID).
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
	router := httputil.NewRouter()
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

/* ------------------------------- utils -------------------------------- */

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
