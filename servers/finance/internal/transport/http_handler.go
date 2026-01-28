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

	// Error messages
	errMsgAccessDenied                 = "Access denied"
	errMsgTransactionNotFound          = "Transaction not found"
	errMsgTransactionAccessDenied      = "You don't have permission to access this transaction"
	errMsgFailedToGetTransaction       = "Failed to get transaction"
	errMsgFailedToUpdateTransaction    = "Failed to update transaction"
	errMsgFailedToDeleteTransaction    = "Failed to delete transaction"
	errMsgAccountNotFound              = "Account not found"
	errMsgAccountAccessDenied          = "You don't have permission to access this account"
	errMsgFailedToGetAccount           = "Failed to get account"
	errMsgFailedToUpdateAccount        = "Failed to update account"
	errMsgFailedToDeleteAccount        = "Failed to delete account"
	errMsgBudgetNotFound               = "Budget not found"
	errMsgBudgetAccessDenied           = "You don't have permission to access this budget"
	errMsgBudgetUpdateAccessDenied     = "You don't have permission to update this budget"
	errMsgBudgetItemUpdateAccessDenied = "You don't have permission to update this budget item"
	errMsgFailedToGetBudget            = "Failed to get budget"
	errMsgFailedToUpdateBudget         = "Failed to update budget"
	errMsgFailedToUpdateBudgetItem     = "Failed to update budget item"
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
			util.WriteErrorResponse(w, http.StatusNotFound, errMsgAccountNotFound, err.Error())
		case service.ErrAccountAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, errMsgAccessDenied, errMsgAccountAccessDenied)
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, errMsgFailedToGetAccount, err.Error())
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
			util.WriteErrorResponse(w, http.StatusNotFound, errMsgAccountNotFound, err.Error())
		case service.ErrAccountAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, errMsgAccessDenied, errMsgAccountAccessDenied)
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, errMsgFailedToUpdateAccount, err.Error())
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
			util.WriteErrorResponse(w, http.StatusNotFound, errMsgAccountNotFound, err.Error())
		case service.ErrAccountAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, errMsgAccessDenied, errMsgAccountAccessDenied)
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, errMsgFailedToGetAccount, err.Error())
		}
		return
	}

	err = h.accountService.DeleteAccount(r.Context(), id, userID)
	if err != nil {
		switch err {
		case service.ErrAccountNotFound:
			util.WriteErrorResponse(w, http.StatusNotFound, errMsgAccountNotFound, err.Error())
		case service.ErrAccountAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, errMsgAccessDenied, errMsgAccountAccessDenied)
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, errMsgFailedToDeleteAccount, err.Error())
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
			util.WriteJSONResponse(w, http.StatusOK, (*model.Budget)(nil), errMsgBudgetNotFound)
		case service.ErrBudgetAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, errMsgAccessDenied, errMsgBudgetAccessDenied)
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, errMsgFailedToGetBudget, err.Error())
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
			util.WriteErrorResponse(w, http.StatusNotFound, errMsgBudgetNotFound, err.Error())
		case service.ErrBudgetAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, errMsgAccessDenied, errMsgBudgetUpdateAccessDenied)
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, errMsgFailedToUpdateBudget, err.Error())
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
			util.WriteErrorResponse(w, http.StatusNotFound, errMsgBudgetNotFound, err.Error())
		case service.ErrBudgetAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, errMsgAccessDenied, errMsgBudgetItemUpdateAccessDenied)
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, errMsgFailedToUpdateBudgetItem, err.Error())
		}
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, updatedItem, "Budget item updated successfully")
}

type CreateTransactionRequest struct {
	Amount       float64               `json:"amount" validate:"required"`
	Date         time.Time             `json:"date" validate:"required"`
	Type         model.TransactionType `json:"type" validate:"required"`
	Currency     string                `json:"currency" validate:"required"`
	Notes        *string               `json:"notes,omitempty"`
	Files        []string              `json:"files,omitempty"`
	AccountID    uuid.UUID             `json:"account_id" validate:"required"`
	BudgetItemID *string               `json:"budget_item_id,omitempty"`
}

type UpdateTransactionRequest struct {
	Amount       *float64               `json:"amount,omitempty"`
	Date         *time.Time             `json:"date,omitempty"`
	Type         *model.TransactionType `json:"type,omitempty"`
	Currency     *string                `json:"currency,omitempty"`
	Notes        *string                `json:"notes,omitempty"`
	Files        []string               `json:"files,omitempty"`
	AccountID    *string                `json:"account_id,omitempty"`
	BudgetItemID *string                `json:"budget_item_id,omitempty"`
}

type TransactionHandler struct {
	oidcClient         *client.OIDCClient
	transactionService service.TransactionService
}

func NewTransactionHandler(oidcClient *client.OIDCClient, transactionService service.TransactionService) *TransactionHandler {
	return &TransactionHandler{
		oidcClient:         oidcClient,
		transactionService: transactionService,
	}
}

func (h *TransactionHandler) SetupRoutes(router *router.Router, middlewares ...func(http.Handler) http.Handler) {
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
	router.HandleFunc("GET /transaction/types", applyMiddleware(h.GetTransactionTypes))

	// Handler for listing and creating transactions
	router.HandleFunc("GET /transactions", applyMiddleware(h.GetTransactions))
	router.HandleFunc("POST /transaction", applyMiddleware(h.CreateTransaction))

	// Handler for getting and updating specific transactions
	router.HandleFunc("GET /transaction/{id}", applyMiddleware(h.GetTransaction))
	router.HandleFunc("PUT /transaction/{id}", applyMiddleware(h.UpdateTransaction))

	// Handler for deleting specific transactions
	router.HandleFunc("DELETE /transaction/{id}", applyMiddleware(h.DeleteTransaction))
}

func (h *TransactionHandler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	var req CreateTransactionRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	var budgetItemID *uuid.UUID
	if req.BudgetItemID != nil && *req.BudgetItemID != "" {
		id, err := uuid.Parse(*req.BudgetItemID)
		if err != nil {
			util.WriteErrorResponse(w, http.StatusBadRequest, "Invalid budget_item_id", err.Error())
			return
		}
		budgetItemID = &id
	}

	transaction := &model.Transaction{
		ID:           uuid.New(),
		Amount:       req.Amount,
		Date:         req.Date,
		Type:         req.Type,
		Currency:     req.Currency,
		Notes:        req.Notes,
		Files:        req.Files,
		UserID:       userID,
		AccountID:    req.AccountID,
		BudgetItemID: budgetItemID,
	}

	transaction, err := h.transactionService.CreateTransaction(r.Context(), transaction)
	if err != nil {
		switch err {
		case service.ErrInvalidTransactionType:
			util.WriteErrorResponse(w, http.StatusBadRequest, "Invalid transaction", err.Error())
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to create transaction", err.Error())
		}
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, transaction, "Transaction created successfully")
}

func (h *TransactionHandler) GetTransaction(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	id, ok := util.ParseUUID(w, idStr)
	if !ok {
		return
	}

	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	transaction, err := h.transactionService.GetTransaction(r.Context(), id, userID)
	if err != nil {
		switch err {
		case service.ErrTransactionNotFound:
			util.WriteErrorResponse(w, http.StatusNotFound, errMsgTransactionNotFound, err.Error())
		case service.ErrTransactionAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, errMsgAccessDenied, errMsgTransactionAccessDenied)
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, errMsgFailedToGetTransaction, err.Error())
		}
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, transaction, "Transaction retrieved successfully")
}

func (h *TransactionHandler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	params := buildTransactionQueryParams(r, userID)

	result, err := h.transactionService.GetTransactions(r.Context(), params)
	if err != nil {
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get transactions", err.Error())
		return
	}

	pagination := util.NewPagination(params.Page, params.Limit, result.Total)
	aggregations := convertTransactionAggregations(result)

	if aggregations != nil {
		util.WriteListResponse(w, http.StatusOK, result.Transactions, pagination, aggregations, "Transactions retrieved successfully")
		return
	}

	util.WritePaginatedJSONResponse(w, http.StatusOK, result.Transactions, pagination, "Transactions retrieved successfully")
}

func (h *TransactionHandler) GetTransactionTypes(w http.ResponseWriter, r *http.Request) {
	raw := model.TransactionTypes()
	util.WriteJSONResponse(w, http.StatusOK, &raw, "Transaction types retrieved successfully")
}

func (h *TransactionHandler) UpdateTransaction(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	id, ok := util.ParseUUID(w, idStr)
	if !ok {
		return
	}

	var req UpdateTransactionRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	input := service.UpdateTransactionInput{
		Amount:       req.Amount,
		Date:         req.Date,
		Type:         req.Type,
		Currency:     req.Currency,
		Notes:        req.Notes,
		Files:        req.Files,
		AccountID:    req.AccountID,
		BudgetItemID: req.BudgetItemID,
	}

	transaction, err := h.transactionService.UpdateTransaction(r.Context(), id, input, userID)
	if err != nil {
		switch err {
		case service.ErrTransactionNotFound:
			util.WriteErrorResponse(w, http.StatusNotFound, errMsgTransactionNotFound, err.Error())
		case service.ErrTransactionAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, errMsgAccessDenied, errMsgTransactionAccessDenied)
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, errMsgFailedToUpdateTransaction, err.Error())
		}
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, transaction, "Transaction updated successfully")
}

func (h *TransactionHandler) DeleteTransaction(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	id, ok := util.ParseUUID(w, idStr)
	if !ok {
		return
	}

	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	transaction, err := h.transactionService.GetTransaction(r.Context(), id, userID)
	if err != nil {
		switch err {
		case service.ErrTransactionNotFound:
			util.WriteErrorResponse(w, http.StatusNotFound, errMsgTransactionNotFound, err.Error())
		case service.ErrTransactionAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, errMsgAccessDenied, errMsgTransactionAccessDenied)
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, errMsgFailedToGetTransaction, err.Error())
		}
		return
	}

	err = h.transactionService.DeleteTransaction(r.Context(), id, userID)
	if err != nil {
		switch err {
		case service.ErrTransactionNotFound:
			util.WriteErrorResponse(w, http.StatusNotFound, errMsgTransactionNotFound, err.Error())
		case service.ErrTransactionAccessDenied:
			util.WriteErrorResponse(w, http.StatusForbidden, errMsgAccessDenied, errMsgTransactionAccessDenied)
		default:
			util.WriteErrorResponse(w, http.StatusInternalServerError, errMsgFailedToDeleteTransaction, err.Error())
		}
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, transaction, "Transaction deleted successfully")
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

func buildTransactionQueryParams(r *http.Request, userID uuid.UUID) service.GetTransactionsParams {
	query := r.URL.Query()

	var startDate, endDate *time.Time
	if startStr := query.Get("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			startDate = &parsed
		}
	}
	if endStr := query.Get("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			// Set time to end of day to include all transactions on this day
			endOfDay := parsed.Add(24 * time.Hour).Add(-1 * time.Nanosecond)
			endDate = &endOfDay
		}
	}

	return service.GetTransactionsParams{
		UserID:     userID,
		Page:       util.GetQueryInt(r, "page", 1),
		Types:      parseQueryValues(query["type"]),
		Currencies: parseQueryValues(query["currency"]),
		Accounts:   parseQueryValues(query["account"]),
		Categories: parseQueryValues(query["category"]),
		StartDate:  startDate,
		EndDate:    endDate,
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
		for part := range strings.SplitSeq(value, ",") {
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

func convertTransactionAggregations(result *service.GetTransactionsResult) *util.Aggregations {
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
	if buckets := convertAggregationResults(result.AccountAggregations); len(buckets) > 0 {
		aggregationsMap["account"] = buckets
	}
	if buckets := convertAggregationResults(result.CategoryAggregations); len(buckets) > 0 {
		aggregationsMap["category"] = buckets
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

// Asset Handler

type CreateAssetRequest struct {
	Name     string          `json:"name" validate:"required"`
	Type     model.AssetType `json:"type" validate:"required"`
	Value    float64         `json:"value"`
	Shares   *float64        `json:"shares,omitempty"`
	Ticker   *string         `json:"ticker,omitempty"`
	Currency string          `json:"currency" validate:"required"`
	Notes    *string         `json:"notes,omitempty"`
}

type UpdateAssetRequest struct {
	Name     *string          `json:"name,omitempty"`
	Type     *model.AssetType `json:"type,omitempty"`
	Value    *float64         `json:"value,omitempty"`
	Shares   *float64         `json:"shares,omitempty"`
	Ticker   *string          `json:"ticker,omitempty"`
	Currency *string          `json:"currency,omitempty"`
	Notes    *string          `json:"notes,omitempty"`
}

type AssetHandler struct {
	oidcClient   *client.OIDCClient
	assetService service.AssetService
}

func NewAssetHandler(oidcClient *client.OIDCClient, assetService service.AssetService) *AssetHandler {
	return &AssetHandler{oidcClient: oidcClient, assetService: assetService}
}

func (h *AssetHandler) SetupRoutes(router *router.Router, middlewares ...func(http.Handler) http.Handler) {
	allMiddlewares := append(middlewares, middleware.AuthMiddleware(h.oidcClient))
	applyMiddleware := func(handler http.HandlerFunc) http.HandlerFunc {
		h := http.Handler(handler)
		for i := len(allMiddlewares) - 1; i >= 0; i-- {
			h = allMiddlewares[i](h)
		}
		return h.ServeHTTP
	}

	router.HandleFunc("GET /asset/types", applyMiddleware(h.GetAssetTypes))
	router.HandleFunc("GET /assets", applyMiddleware(h.GetAssets))
	router.HandleFunc("POST /asset", applyMiddleware(h.CreateAsset))
	router.HandleFunc("GET /asset/{id}", applyMiddleware(h.GetAsset))
	router.HandleFunc("PUT /asset/{id}", applyMiddleware(h.UpdateAsset))
	router.HandleFunc("DELETE /asset/{id}", applyMiddleware(h.DeleteAsset))
}

func (h *AssetHandler) CreateAsset(w http.ResponseWriter, r *http.Request) {
	var req CreateAssetRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	asset := &model.Asset{
		ID: uuid.New(), Name: req.Name, Type: req.Type, Value: req.Value,
		Shares: req.Shares, Ticker: req.Ticker, Currency: req.Currency, UserID: userID, Notes: req.Notes,
	}

	asset, err := h.assetService.CreateAsset(r.Context(), asset)
	if err != nil {
		if err == service.ErrInvalidAssetType {
			util.WriteErrorResponse(w, http.StatusBadRequest, "Invalid asset type", err.Error())
			return
		}
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to create asset", err.Error())
		return
	}
	util.WriteJSONResponse(w, http.StatusOK, asset, "Asset created successfully")
}

func (h *AssetHandler) GetAsset(w http.ResponseWriter, r *http.Request) {
	id, ok := util.ParseUUID(w, util.GetPathParam(r, "id"))
	if !ok {
		return
	}
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	asset, err := h.assetService.GetAsset(r.Context(), id, userID)
	if err != nil {
		if err == service.ErrAssetNotFound {
			util.WriteErrorResponse(w, http.StatusNotFound, "Asset not found", err.Error())
			return
		}
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get asset", err.Error())
		return
	}
	util.WriteJSONResponse(w, http.StatusOK, asset, "Asset retrieved successfully")
}

func (h *AssetHandler) GetAssets(w http.ResponseWriter, r *http.Request) {
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	query := r.URL.Query()
	params := service.GetAssetsParams{
		UserID:     userID,
		Page:       util.GetQueryInt(r, "page", 1),
		Limit:      clampLimit(util.GetQueryInt(r, "limit", minQueryLimit)),
		Types:      parseQueryValues(query["type"]),
		Currencies: parseQueryValues(query["currency"]),
		OrderBy:    pickOrderBy(query.Get("order_by")),
	}

	result, err := h.assetService.GetAssets(r.Context(), params)
	if err != nil {
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get assets", err.Error())
		return
	}

	pagination := util.NewPagination(params.Page, params.Limit, result.Total)
	util.WritePaginatedJSONResponse(w, http.StatusOK, result.Assets, pagination, "Assets retrieved successfully")
}

func (h *AssetHandler) GetAssetTypes(w http.ResponseWriter, r *http.Request) {
	types := model.AssetTypes()
	util.WriteJSONResponse(w, http.StatusOK, &types, "Asset types retrieved successfully")
}

func (h *AssetHandler) UpdateAsset(w http.ResponseWriter, r *http.Request) {
	id, ok := util.ParseUUID(w, util.GetPathParam(r, "id"))
	if !ok {
		return
	}
	var req UpdateAssetRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	input := service.UpdateAssetInput{
		Name: req.Name, Type: req.Type, Value: req.Value, Shares: req.Shares,
		Ticker: req.Ticker, Currency: req.Currency, Notes: req.Notes,
	}

	asset, err := h.assetService.UpdateAsset(r.Context(), id, input, userID)
	if err != nil {
		if err == service.ErrAssetNotFound {
			util.WriteErrorResponse(w, http.StatusNotFound, "Asset not found", err.Error())
			return
		}
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to update asset", err.Error())
		return
	}
	util.WriteJSONResponse(w, http.StatusOK, asset, "Asset updated successfully")
}

func (h *AssetHandler) DeleteAsset(w http.ResponseWriter, r *http.Request) {
	id, ok := util.ParseUUID(w, util.GetPathParam(r, "id"))
	if !ok {
		return
	}
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	if err := h.assetService.DeleteAsset(r.Context(), id, userID); err != nil {
		if err == service.ErrAssetNotFound {
			util.WriteErrorResponse(w, http.StatusNotFound, "Asset not found", err.Error())
			return
		}
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to delete asset", err.Error())
		return
	}
	util.WriteJSONResponse(w, http.StatusOK, (*struct{})(nil), "Asset deleted successfully")
}

// Liability Handler

type CreateLiabilityRequest struct {
	Name     string              `json:"name" validate:"required"`
	Type     model.LiabilityType `json:"type" validate:"required"`
	Amount   float64             `json:"amount"`
	Currency string              `json:"currency" validate:"required"`
	Notes    *string             `json:"notes,omitempty"`
}

type UpdateLiabilityRequest struct {
	Name     *string              `json:"name,omitempty"`
	Type     *model.LiabilityType `json:"type,omitempty"`
	Amount   *float64             `json:"amount,omitempty"`
	Currency *string              `json:"currency,omitempty"`
	PaidAt   *time.Time           `json:"paid_at,omitempty"`
	Notes    *string              `json:"notes,omitempty"`
}

type LiabilityHandler struct {
	oidcClient       *client.OIDCClient
	liabilityService service.LiabilityService
}

func NewLiabilityHandler(oidcClient *client.OIDCClient, liabilityService service.LiabilityService) *LiabilityHandler {
	return &LiabilityHandler{oidcClient: oidcClient, liabilityService: liabilityService}
}

func (h *LiabilityHandler) SetupRoutes(router *router.Router, middlewares ...func(http.Handler) http.Handler) {
	allMiddlewares := append(middlewares, middleware.AuthMiddleware(h.oidcClient))
	applyMiddleware := func(handler http.HandlerFunc) http.HandlerFunc {
		h := http.Handler(handler)
		for i := len(allMiddlewares) - 1; i >= 0; i-- {
			h = allMiddlewares[i](h)
		}
		return h.ServeHTTP
	}

	router.HandleFunc("GET /liability/types", applyMiddleware(h.GetLiabilityTypes))
	router.HandleFunc("GET /liabilities", applyMiddleware(h.GetLiabilities))
	router.HandleFunc("POST /liability", applyMiddleware(h.CreateLiability))
	router.HandleFunc("GET /liability/{id}", applyMiddleware(h.GetLiability))
	router.HandleFunc("PUT /liability/{id}", applyMiddleware(h.UpdateLiability))
	router.HandleFunc("DELETE /liability/{id}", applyMiddleware(h.DeleteLiability))
}

func (h *LiabilityHandler) CreateLiability(w http.ResponseWriter, r *http.Request) {
	var req CreateLiabilityRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	liability := &model.Liability{
		ID: uuid.New(), Name: req.Name, Type: req.Type, Amount: req.Amount,
		Currency: req.Currency, UserID: userID, Notes: req.Notes,
	}

	liability, err := h.liabilityService.CreateLiability(r.Context(), liability)
	if err != nil {
		if err == service.ErrInvalidLiabilityType {
			util.WriteErrorResponse(w, http.StatusBadRequest, "Invalid liability type", err.Error())
			return
		}
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to create liability", err.Error())
		return
	}
	util.WriteJSONResponse(w, http.StatusOK, liability, "Liability created successfully")
}

func (h *LiabilityHandler) GetLiability(w http.ResponseWriter, r *http.Request) {
	id, ok := util.ParseUUID(w, util.GetPathParam(r, "id"))
	if !ok {
		return
	}
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	liability, err := h.liabilityService.GetLiability(r.Context(), id, userID)
	if err != nil {
		if err == service.ErrLiabilityNotFound {
			util.WriteErrorResponse(w, http.StatusNotFound, "Liability not found", err.Error())
			return
		}
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get liability", err.Error())
		return
	}
	util.WriteJSONResponse(w, http.StatusOK, liability, "Liability retrieved successfully")
}

func (h *LiabilityHandler) GetLiabilities(w http.ResponseWriter, r *http.Request) {
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	query := r.URL.Query()
	params := service.GetLiabilitiesParams{
		UserID:     userID,
		Page:       util.GetQueryInt(r, "page", 1),
		Limit:      clampLimit(util.GetQueryInt(r, "limit", minQueryLimit)),
		Types:      parseQueryValues(query["type"]),
		Currencies: parseQueryValues(query["currency"]),
		OrderBy:    pickOrderBy(query.Get("order_by")),
	}

	result, err := h.liabilityService.GetLiabilities(r.Context(), params)
	if err != nil {
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get liabilities", err.Error())
		return
	}

	pagination := util.NewPagination(params.Page, params.Limit, result.Total)
	util.WritePaginatedJSONResponse(w, http.StatusOK, result.Liabilities, pagination, "Liabilities retrieved successfully")
}

func (h *LiabilityHandler) GetLiabilityTypes(w http.ResponseWriter, r *http.Request) {
	types := model.LiabilityTypes()
	util.WriteJSONResponse(w, http.StatusOK, &types, "Liability types retrieved successfully")
}

func (h *LiabilityHandler) UpdateLiability(w http.ResponseWriter, r *http.Request) {
	id, ok := util.ParseUUID(w, util.GetPathParam(r, "id"))
	if !ok {
		return
	}
	var req UpdateLiabilityRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	input := service.UpdateLiabilityInput{
		Name: req.Name, Type: req.Type, Amount: req.Amount,
		Currency: req.Currency, PaidAt: req.PaidAt, Notes: req.Notes,
	}

	liability, err := h.liabilityService.UpdateLiability(r.Context(), id, input, userID)
	if err != nil {
		if err == service.ErrLiabilityNotFound {
			util.WriteErrorResponse(w, http.StatusNotFound, "Liability not found", err.Error())
			return
		}
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to update liability", err.Error())
		return
	}
	util.WriteJSONResponse(w, http.StatusOK, liability, "Liability updated successfully")
}

func (h *LiabilityHandler) DeleteLiability(w http.ResponseWriter, r *http.Request) {
	id, ok := util.ParseUUID(w, util.GetPathParam(r, "id"))
	if !ok {
		return
	}
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	if err := h.liabilityService.DeleteLiability(r.Context(), id, userID); err != nil {
		if err == service.ErrLiabilityNotFound {
			util.WriteErrorResponse(w, http.StatusNotFound, "Liability not found", err.Error())
			return
		}
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to delete liability", err.Error())
		return
	}
	util.WriteJSONResponse(w, http.StatusOK, (*struct{})(nil), "Liability deleted successfully")
}

// Dashboard Handler

type DashboardHandler struct {
	oidcClient       *client.OIDCClient
	dashboardService service.DashboardService
}

func NewDashboardHandler(oidcClient *client.OIDCClient, dashboardService service.DashboardService) *DashboardHandler {
	return &DashboardHandler{
		oidcClient:       oidcClient,
		dashboardService: dashboardService,
	}
}

func (h *DashboardHandler) SetupRoutes(router *router.Router, middlewares ...func(http.Handler) http.Handler) {
	allMiddlewares := append(middlewares, middleware.AuthMiddleware(h.oidcClient))
	applyMiddleware := func(handler http.HandlerFunc) http.HandlerFunc {
		h := http.Handler(handler)
		for i := len(allMiddlewares) - 1; i >= 0; i-- {
			h = allMiddlewares[i](h)
		}
		return h.ServeHTTP
	}

	router.HandleFunc("GET /dashboard/summary", applyMiddleware(h.GetDashboardSummary))
	router.HandleFunc("GET /dashboard/accounts", applyMiddleware(h.GetAccountAggregations))
	router.HandleFunc("GET /dashboard/budget-performance", applyMiddleware(h.GetBudgetPerformance))
	router.HandleFunc("GET /dashboard/transaction-trends", applyMiddleware(h.GetTransactionTrends))
	router.HandleFunc("GET /dashboard/expense-breakdown", applyMiddleware(h.GetExpenseBreakdown))
}

func (h *DashboardHandler) GetDashboardSummary(w http.ResponseWriter, r *http.Request) {
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	query := r.URL.Query()
	params := service.SummaryParams{
		UserID: userID,
	}

	if startStr := query.Get("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			params.StartDate = &parsed
		}
	}
	if endStr := query.Get("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			params.EndDate = &parsed
		}
	}

	result, err := h.dashboardService.GetSummary(r.Context(), params)
	if err != nil {
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get dashboard summary", err.Error())
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, result, "Dashboard summary retrieved successfully")
}

func (h *DashboardHandler) GetAccountAggregations(w http.ResponseWriter, r *http.Request) {
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	result, err := h.dashboardService.GetAccountAggregations(r.Context(), userID)
	if err != nil {
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get account aggregations", err.Error())
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, result, "Account aggregations retrieved successfully")
}

func (h *DashboardHandler) GetBudgetPerformance(w http.ResponseWriter, r *http.Request) {
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	month := util.GetQueryInt(r, "month", int(time.Now().Month()))
	year := util.GetQueryInt(r, "year", time.Now().Year())

	result, err := h.dashboardService.GetBudgetPerformance(r.Context(), userID, month, year)
	if err != nil {
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get budget performance", err.Error())
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, result, "Budget performance retrieved successfully")
}

func (h *DashboardHandler) GetTransactionTrends(w http.ResponseWriter, r *http.Request) {
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	query := r.URL.Query()
	var startDate, endDate time.Time
	var err error

	startStr := query.Get("start_date")
	if startStr != "" {
		startDate, err = time.Parse("2006-01-02", startStr)
		if err != nil {
			util.WriteErrorResponse(w, http.StatusBadRequest, "Invalid start_date format", "Use YYYY-MM-DD format")
			return
		}
	} else {
		startDate = time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.UTC)
	}

	endStr := query.Get("end_date")
	if endStr != "" {
		endDate, err = time.Parse("2006-01-02", endStr)
		if err != nil {
			util.WriteErrorResponse(w, http.StatusBadRequest, "Invalid end_date format", "Use YYYY-MM-DD format")
			return
		}
	} else {
		endDate = time.Date(time.Now().Year(), time.Now().Month()+1, 1, 0, 0, 0, 0, time.UTC).Add(-time.Second)
	}

	granularity := query.Get("granularity")
	if granularity == "" {
		granularity = "month"
	}

	result, err := h.dashboardService.GetTransactionTrends(r.Context(), userID, startDate, endDate, granularity)
	if err != nil {
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get transaction trends", err.Error())
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, result, "Transaction trends retrieved successfully")
}

func (h *DashboardHandler) GetExpenseBreakdown(w http.ResponseWriter, r *http.Request) {
	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	query := r.URL.Query()
	var startDate, endDate time.Time
	var err error

	startStr := query.Get("start_date")
	if startStr != "" {
		startDate, err = time.Parse("2006-01-02", startStr)
		if err != nil {
			util.WriteErrorResponse(w, http.StatusBadRequest, "Invalid start_date format", "Use YYYY-MM-DD format")
			return
		}
	} else {
		startDate = time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.UTC)
	}

	endStr := query.Get("end_date")
	if endStr != "" {
		endDate, err = time.Parse("2006-01-02", endStr)
		if err != nil {
			util.WriteErrorResponse(w, http.StatusBadRequest, "Invalid end_date format", "Use YYYY-MM-DD format")
			return
		}
	} else {
		endDate = time.Date(time.Now().Year(), time.Now().Month()+1, 1, 0, 0, 0, 0, time.UTC).Add(-time.Second)
	}

	result, err := h.dashboardService.GetExpenseBreakdown(r.Context(), userID, startDate, endDate)
	if err != nil {
		util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get expense breakdown", err.Error())
		return
	}

	util.WriteJSONResponse(w, http.StatusOK, result, "Expense breakdown retrieved successfully")
}
