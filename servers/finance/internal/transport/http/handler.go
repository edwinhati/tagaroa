package http

import (
	"net/http"
	"strings"

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	"github.com/edwinhati/tagaroa/packages/shared/go/middleware"
	httputil "github.com/edwinhati/tagaroa/packages/shared/go/transport/http"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/service"
	"github.com/google/uuid"
)

const (
	defaultOrderByClause = "created_at DESC"
	minQueryLimit        = 5
	maxQueryLimit        = 50
)

type CreateAccountRequest struct {
	Name     string            `json:"name" validate:"required"`
	Type     model.AccountType `json:"type" validate:"required"`
	Balance  float64           `json:"balance"`
	Currency string            `json:"currency" validate:"required"`
	Notes    *string           `json:"notes,omitempty"`
}

type UpdateAccountRequest struct {
	Name      *string  `json:"name,omitempty"`
	Balance   *float64 `json:"balance,omitempty"`
	Currency  *string  `json:"currency,omitempty"`
	Notes     *string  `json:"notes,omitempty"`
	IsDeleted *bool    `json:"is_deleted,omitempty"`
}

type AccountHandler struct {
	oidcClient     *client.OIDCClient
	accountService service.AccountService
}

func NewAccountHandler(oidcClient *client.OIDCClient, accountService service.AccountService) *AccountHandler {
	return &AccountHandler{
		oidcClient:     oidcClient,
		accountService: accountService,
	}
}

func (h *AccountHandler) SetupRoutes(router *httputil.Router, middlewares ...func(http.Handler) http.Handler) {
	// Combine middlewares with auth middleware
	allMiddlewares := append(middlewares, middleware.AuthMiddleware(h.oidcClient))

	// Apply middleware to individual routes
	applyMiddleware := func(handler http.HandlerFunc) http.HandlerFunc {
		h := http.Handler(handler)
		for i := len(allMiddlewares) - 1; i >= 0; i-- {
			h = allMiddlewares[i](h)
		}
		return h.ServeHTTP
	}

	// Register specific routes first
	router.HandleFunc("GET /account/types", applyMiddleware(h.GetAccountTypes))

	// Handler for listing and creating accounts
	router.HandleFunc("GET /account", applyMiddleware(h.GetAccounts))
	router.HandleFunc("POST /account", applyMiddleware(h.CreateAccount))

	// Handler for getting and updating specific accounts
	router.HandleFunc("GET /account/{id}", applyMiddleware(h.GetAccount))
	router.HandleFunc("PUT /account/{id}", applyMiddleware(h.UpdateAccount))
}

func (h *AccountHandler) CreateAccount(w http.ResponseWriter, r *http.Request) {
	var req CreateAccountRequest
	if !httputil.ParseJSONBody(w, r, &req) {
		return
	}

	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	account := &model.Account{
		ID:       uuid.New(),
		Name:     req.Name,
		Type:     req.Type,
		Balance:  req.Balance,
		UserID:   userID,
		Currency: req.Currency,
		Notes:    req.Notes,
	}

	account, err := h.accountService.CreateAccount(r.Context(), account)
	if err != nil {
		switch err {
		case service.ErrInvalidAccountType:
			httputil.WriteErrorResponse(w, http.StatusBadRequest, "Invalid account", err.Error())
		default:
			httputil.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to create account", err.Error())
		}
		return
	}

	httputil.WriteJSONResponse(w, http.StatusOK, account, "Account created successfully")
}

func (h *AccountHandler) GetAccount(w http.ResponseWriter, r *http.Request) {
	idStr := httputil.GetPathParam(r, "id")
	id, ok := httputil.ParseUUID(w, idStr)
	if !ok {
		return
	}

	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	account, err := h.accountService.GetAccount(r.Context(), id, userID)
	if err != nil {
		switch err {
		case service.ErrAccountNotFound:
			httputil.WriteErrorResponse(w, http.StatusNotFound, "Account not found", err.Error())
		case service.ErrAccessDenied:
			httputil.WriteErrorResponse(w, http.StatusForbidden, "Access denied", "You don't have permission to access this account")
		default:
			httputil.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get account", err.Error())
		}
		return
	}

	httputil.WriteJSONResponse(w, http.StatusOK, account, "Account retrieved successfully")
}

func (h *AccountHandler) GetAccounts(w http.ResponseWriter, r *http.Request) {
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	params := buildAccountQueryParams(r, userID)

	result, err := h.accountService.GetAccounts(r.Context(), params)
	if err != nil {
		httputil.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get accounts", err.Error())
		return
	}

	pagination := httputil.NewPagination(params.Page, params.Limit, result.Total)
	aggregations := convertAggregations(result)

	if aggregations != nil {
		httputil.WriteListResponse(w, http.StatusOK, result.Accounts, pagination, aggregations, "Accounts retrieved successfully")
		return
	}

	httputil.WritePaginatedJSONResponse(w, http.StatusOK, result.Accounts, pagination, "Accounts retrieved successfully")
}

func buildAccountQueryParams(r *http.Request, userID uuid.UUID) service.GetAccountsParams {
	query := r.URL.Query()
	return service.GetAccountsParams{
		UserID:     userID,
		Page:       httputil.GetQueryInt(r, "page", 1),
		Types:      parseQueryValues(query["type"]),
		Currencies: parseQueryValues(query["currency"]),
		Search:     strings.TrimSpace(query.Get("search")),
		Limit:      clampLimit(httputil.GetQueryInt(r, "limit", minQueryLimit)),
		OrderBy:    pickOrderBy(query.Get("order_by")),
	}
}

func parseQueryValues(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	var parsed []string
	for _, value := range values {
		for _, part := range strings.Split(value, ",") {
			if trimmed := strings.TrimSpace(part); trimmed != "" {
				parsed = append(parsed, trimmed)
			}
		}
	}
	return parsed
}

func pickOrderBy(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return defaultOrderByClause
	}
	return raw
}

func clampLimit(value int) int {
	switch {
	case value <= 0:
		return minQueryLimit
	case value < minQueryLimit:
		return minQueryLimit
	case value > maxQueryLimit:
		return maxQueryLimit
	default:
		return value
	}
}

func convertAggregations(result *service.GetAccountsResult) *httputil.Aggregations {
	if result == nil {
		return nil
	}

	aggregationsMap := make(httputil.Aggregations)
	if buckets := convertAggregationResults(result.TypeAggregations); len(buckets) > 0 {
		aggregationsMap["type"] = buckets
	}
	if buckets := convertAggregationResults(result.CurrencyAggregations); len(buckets) > 0 {
		aggregationsMap["currency"] = buckets
	}

	if len(aggregationsMap) == 0 {
		return nil
	}
	return &aggregationsMap
}

func convertAggregationResults(source map[string]util.AggregationResult) []httputil.Bucket {
	if len(source) == 0 {
		return nil
	}

	buckets := make([]httputil.Bucket, 0, len(source))
	for key, agg := range source {
		buckets = append(buckets, httputil.Bucket{
			Key:   key,
			Count: agg.Count,
			Min:   agg.Min,
			Max:   agg.Max,
			Avg:   agg.Avg,
			Sum:   agg.Sum,
		})
	}
	return buckets
}

func (h *AccountHandler) GetAccountTypes(w http.ResponseWriter, r *http.Request) {
	raw := model.AccountTypes()
	httputil.WriteJSONResponse(w, http.StatusOK, &raw, "Account types retrieved successfully")
}

func (h *AccountHandler) UpdateAccount(w http.ResponseWriter, r *http.Request) {
	idStr := httputil.GetPathParam(r, "id")
	id, ok := httputil.ParseUUID(w, idStr)
	if !ok {
		return
	}

	var req UpdateAccountRequest
	if !httputil.ParseJSONBody(w, r, &req) {
		return
	}

	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}
	input := service.UpdateAccountInput{
		Name:      req.Name,
		Currency:  req.Currency,
		Notes:     req.Notes,
		Balance:   req.Balance,
		IsDeleted: req.IsDeleted,
	}
	account, err := h.accountService.UpdateAccount(r.Context(), id, input, userID)
	if err != nil {
		switch err {
		case service.ErrAccountNotFound:
			httputil.WriteErrorResponse(w, http.StatusNotFound, "Account not found", err.Error())
		case service.ErrAccessDenied:
			httputil.WriteErrorResponse(w, http.StatusForbidden, "Access denied", "You don't have permission to access this account")
		default:
			httputil.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to update account", err.Error())
		}
		return
	}

	httputil.WriteJSONResponse(w, http.StatusOK, account, "Account updated successfully")
}
