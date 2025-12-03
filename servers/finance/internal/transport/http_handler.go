package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	"github.com/edwinhati/tagaroa/packages/shared/go/middleware"
	"github.com/edwinhati/tagaroa/packages/shared/go/router"
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
	Name     *string  `json:"name,omitempty"`
	Balance  *float64 `json:"balance,omitempty"`
	Currency *string  `json:"currency,omitempty"`
	Notes    *string  `json:"notes,omitempty"`
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

func (h *AccountHandler) SetupRoutes(router *router.Router, middlewares ...func(http.Handler) http.Handler) {
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
	router.HandleFunc("GET /accounts", applyMiddleware(h.GetAccounts))
	router.HandleFunc("POST /account", applyMiddleware(h.CreateAccount))

	// Handler for getting and updating specific accounts
	router.HandleFunc("GET /account/{id}", applyMiddleware(h.GetAccount))
	router.HandleFunc("PUT /account/{id}", applyMiddleware(h.UpdateAccount))

	// Handler for deleting specific accounts
	router.HandleFunc("DELETE /account/{id}", applyMiddleware(h.DeleteAccount))
}

func (h *AccountHandler) CreateAccount(w http.ResponseWriter, r *http.Request) {
	var req CreateAccountRequest
	if !util.ParseJSONBody(w, r, &req) {
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
			util.WriteErrorResponse(w, http.StatusBadRequest, "Invalid account", err.Error())
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to create account", err.Error())
		}
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, account, "Account created successfully")
}

func (h *AccountHandler) GetAccount(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	id, ok := util.ParseUUID(w, idStr)
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
			util.WriteErrorResponse(w, http.StatusNotFound, "Account not found", err.Error())
		case service.ErrAccountAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, "Access denied", "You don't have permission to access this account")
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get account", err.Error())
		}
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, account, "Account retrieved successfully")
}

func (h *AccountHandler) GetAccounts(w http.ResponseWriter, r *http.Request) {
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	params := buildAccountQueryParams(r, userID)

	result, err := h.accountService.GetAccounts(r.Context(), params)
	if err != nil {
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get accounts", err.Error())
		return
	}

	pagination := util.NewPagination(params.Page, params.Limit, result.Total)
	aggregations := convertAggregations(result)

	if aggregations != nil {
		util.WriteListResponse(w, http.StatusOK, result.Accounts, pagination, aggregations, "Accounts retrieved successfully")
		return
	}

	util.WritePaginatedJSONResponse(w, http.StatusOK, result.Accounts, pagination, "Accounts retrieved successfully")
}

func (h *AccountHandler) GetAccountTypes(w http.ResponseWriter, r *http.Request) {
	raw := model.AccountTypes()
	util.WriteJSONResponse(w, http.StatusOK, &raw, "Account types retrieved successfully")
}

func (h *AccountHandler) UpdateAccount(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	id, ok := util.ParseUUID(w, idStr)
	if !ok {
		return
	}

	var req UpdateAccountRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}
	input := service.UpdateAccountInput{
		Name:     req.Name,
		Currency: req.Currency,
		Notes:    req.Notes,
		Balance:  req.Balance,
	}
	account, err := h.accountService.UpdateAccount(r.Context(), id, input, userID)
	if err != nil {
		switch err {
		case service.ErrAccountNotFound:
			util.WriteErrorResponse(w, http.StatusNotFound, "Account not found", err.Error())
		case service.ErrAccountAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, "Access denied", "You don't have permission to access this account")
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to update account", err.Error())
		}
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, account, "Account updated successfully")
}

func (h *AccountHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	id, ok := util.ParseUUID(w, idStr)
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
			util.WriteErrorResponse(w, http.StatusNotFound, "Account not found", err.Error())
		case service.ErrAccountAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, "Access denied", "You don't have permission to access this account")
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get account", err.Error())
		}
		return
	}

	err = h.accountService.DeleteAccount(r.Context(), id, userID)
	if err != nil {
		switch err {
		case service.ErrAccountNotFound:
			util.WriteErrorResponse(w, http.StatusNotFound, "Account not found", err.Error())
		case service.ErrAccountAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, "Access denied", "You don't have permission to access this account")
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to delete account", err.Error())
		}
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, account, "Account deleted successfully")
}

type CreateBudgetRequest struct {
	Month    int     `json:"month" validate:"required"`
	Year     int     `json:"year" validate:"required"`
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency" validate:"required"`
}

type UpdateBudgetRequest struct {
	Month    *int     `json:"month,omitempty"`
	Year     *int     `json:"year,omitempty"`
	Amount   *float64 `json:"amount,omitempty"`
	Currency *string  `json:"currency,omitempty"`
}

type BudgetHandler struct {
	oidcClient    *client.OIDCClient
	budgetService service.BudgetService
}

func NewBudgetHandler(oidcClient *client.OIDCClient, budgetService service.BudgetService) *BudgetHandler {
	return &BudgetHandler{
		oidcClient:    oidcClient,
		budgetService: budgetService,
	}
}

func (h *BudgetHandler) SetupRoutes(router *router.Router, middlewares ...func(http.Handler) http.Handler) {
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
	// router.HandleFunc("GET /budget/categories", applyMiddleware(h.GetAccountTypes))

	// Handler for listing and creating budgets
	router.HandleFunc("GET /budget", applyMiddleware(h.GetBudget))
	router.HandleFunc("GET /budgets", applyMiddleware(h.GetBudgets))
	router.HandleFunc("POST /budget", applyMiddleware(h.CreateBudget))
	router.HandleFunc("PUT /budget/{id}", applyMiddleware(h.UpdateBudget))

	// Handler for budget items
	router.HandleFunc("PUT /budget/item/{id}", applyMiddleware(h.UpdateBudgetItem))
}

func (h *BudgetHandler) CreateBudget(w http.ResponseWriter, r *http.Request) {
	var req CreateBudgetRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	budget := &model.Budget{
		ID:       uuid.New(),
		Month:    req.Month,
		Year:     req.Year,
		Amount:   req.Amount,
		UserID:   userID,
		Currency: req.Currency,
	}

	budget, err := h.budgetService.CreateBudget(r.Context(), budget)
	if err != nil {
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to create budget", err.Error())
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, budget, "Budget created successfully")
}

func (h *BudgetHandler) GetBudget(w http.ResponseWriter, r *http.Request) {
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	account, err := h.budgetService.GetBudget(r.Context(), util.GetQueryInt(r, "month", int(time.Now().Month())), util.GetQueryInt(r, "year", time.Now().Year()), userID)
	if err != nil {
		switch err {
		case service.ErrBudgetNotFound:
			util.WriteJSONResponse(w, http.StatusOK, (*model.Budget)(nil), "Budget not found")
		case service.ErrBudgetAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, "Access denied", "You don't have permission to access this budget")
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get budget", err.Error())
		}
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, account, "Budget retrieved successfully")
}

func (h *BudgetHandler) GetBudgets(w http.ResponseWriter, r *http.Request) {
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	params := buildBudgetQueryParams(r, userID)

	result, err := h.budgetService.GetBudgets(r.Context(), params)
	if err != nil {
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get budgets", err.Error())
		return
	}

	pagination := util.NewPagination(params.Page, params.Limit, result.Total)

	util.WritePaginatedJSONResponse(w, http.StatusOK, result.Budgets, pagination, "Budgets retrieved successfully")
}

func (h *BudgetHandler) UpdateBudget(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	id, ok := util.ParseUUID(w, idStr)
	if !ok {
		return
	}

	var req UpdateBudgetRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	input := service.UpdateBudgetInput{
		Month:    req.Month,
		Year:     req.Year,
		Amount:   req.Amount,
		Currency: req.Currency,
	}

	budget, err := h.budgetService.UpdateBudget(r.Context(), id, input, userID)
	if err != nil {
		switch err {
		case service.ErrBudgetNotFound:
			util.WriteErrorResponse(w, http.StatusNotFound, "Budget not found", err.Error())
		case service.ErrBudgetAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, "Access denied", "You don't have permission to update this budget")
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to update budget", err.Error())
		}
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, budget, "Budget updated successfully")
}

type UpdateBudgetItemRequest struct {
	Allocation float64    `json:"allocation"`
	Category   string     `json:"category"`
	BudgetID   *uuid.UUID `json:"budget_id"`
}

func (h *BudgetHandler) UpdateBudgetItem(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	id, ok := util.ParseUUID(w, idStr)
	if !ok {
		return
	}

	var req UpdateBudgetItemRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	item := &model.BudgetItem{
		ID:         id,
		Allocation: req.Allocation,
		Category:   req.Category,
		BudgetID:   req.BudgetID,
	}

	updatedItem, err := h.budgetService.UpdateBudgetItem(r.Context(), item, userID)
	if err != nil {
		switch err {
		case service.ErrBudgetNotFound:
			util.WriteErrorResponse(w, http.StatusNotFound, "Budget not found", err.Error())
		case service.ErrBudgetAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, "Access denied", "You don't have permission to update this budget item")
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to update budget item", err.Error())
		}
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, updatedItem, "Budget item updated successfully")
}

func buildAccountQueryParams(r *http.Request, userID uuid.UUID) service.GetAccountsParams {
	query := r.URL.Query()
	return service.GetAccountsParams{
		UserID:     userID,
		Page:       util.GetQueryInt(r, "page", 1),
		Types:      parseQueryValues(query["type"]),
		Currencies: parseQueryValues(query["currency"]),
		Search:     strings.TrimSpace(query.Get("search")),
		Limit:      clampLimit(util.GetQueryInt(r, "limit", minQueryLimit)),
		OrderBy:    pickOrderBy(query.Get("order_by")),
	}
}

func buildBudgetQueryParams(r *http.Request, userID uuid.UUID) service.GetBudgetsParams {
	return service.GetBudgetsParams{
		UserID: userID,
		Page:   util.GetQueryInt(r, "page", 1),
		Limit:  clampLimit(util.GetQueryInt(r, "limit", minQueryLimit)),
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

func convertAggregations(result *service.GetAccountsResult) *util.Aggregations {
	if result == nil {
		return nil
	}

	aggregationsMap := make(util.Aggregations)
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

func convertAggregationResults(source map[string]util.AggregationResult) []util.Bucket {
	if len(source) == 0 {
		return nil
	}

	buckets := make([]util.Bucket, 0, len(source))
	for key, agg := range source {
		buckets = append(buckets, util.Bucket{
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
