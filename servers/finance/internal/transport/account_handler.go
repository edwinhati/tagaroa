package httphandler

import (
	"net/http"

	appaccount "github.com/edwinhati/tagaroa/servers/finance/internal/application/account"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/account"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	infrahttp "github.com/edwinhati/tagaroa/servers/finance/internal/infrastructure/http"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/util"
)

// AccountHandler handles HTTP requests for accounts
type AccountHandler struct {
	accountService *appaccount.Service
}

// NewAccountHandler creates a new account handler
func NewAccountHandler(accountService *appaccount.Service) *AccountHandler {
	return &AccountHandler{
		accountService: accountService,
	}
}

// SetupRoutes sets up the account routes
func (h *AccountHandler) SetupRoutes(router *infrahttp.RouterGroup) {
	router.HandleFunc("GET /accounts", h.GetAccounts)
	router.HandleFunc("POST /accounts", h.CreateAccount)
	router.HandleFunc("GET /accounts/{id}", h.GetAccount)
	router.HandleFunc("PUT /accounts/{id}", h.UpdateAccount)
	router.HandleFunc("DELETE /accounts/{id}", h.DeleteAccount)
	router.HandleFunc("GET /account/types", h.GetAccountTypes)
}

// CreateAccountRequest represents a request to create an account
type CreateAccountRequest struct {
	Name     string  `json:"name" validate:"required"`
	Type     string  `json:"type" validate:"required"`
	Balance  float64 `json:"balance"`
	Currency string  `json:"currency" validate:"required"`
	Notes    *string `json:"notes,omitempty"`
}

// UpdateAccountRequest represents a request to update an account
type UpdateAccountRequest struct {
	Name    *string  `json:"name,omitempty"`
	Balance *float64 `json:"balance,omitempty"`
	Notes   *string  `json:"notes,omitempty"`
}

func (h *AccountHandler) CreateAccount(w http.ResponseWriter, r *http.Request) {
	var req CreateAccountRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	currency := shared.Currency(req.Currency)
	if !currency.IsValid() {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_CURRENCY", "Invalid Currency", "Currency must be one of: USD, IDR, EUR, GBP, JPY, SGD")
		return
	}

	accountType := account.AccountType(req.Type)
	if !accountType.IsValid() {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_TYPE", "Invalid Account Type", "Account type must be one of: checking, savings, credit, investment, cash")
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	input := appaccount.CreateAccountInput{
		Name:           req.Name,
		Type:           accountType,
		InitialBalance: req.Balance,
		UserID:         userID,
		Currency:       currency,
		Notes:          req.Notes,
	}

	acc, err := h.accountService.CreateAccount(r.Context(), input)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "CREATE_FAILED", "Failed to Create Account", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusCreated, acc, util.JsonApiMeta{
		Message: "Account created successfully",
	}, nil)
}

func (h *AccountHandler) GetAccount(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	id, ok := util.ParseUUID(w, idStr)
	if !ok {
		return
	}

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	acc, err := h.accountService.GetAccount(r.Context(), id, userID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Account", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, acc, util.JsonApiMeta{
		Message: "Account retrieved successfully",
	}, nil)
}

func (h *AccountHandler) GetAccounts(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	accounts, err := h.accountService.GetAccounts(r.Context(), userID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Accounts", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, accounts, util.JsonApiMeta{
		Message: "Accounts retrieved successfully",
	}, nil)
}

func (h *AccountHandler) GetAccountTypes(w http.ResponseWriter, r *http.Request) {
	types := account.AllAccountTypes()
	util.WriteJsonApiResponse(w, r, http.StatusOK, types, util.JsonApiMeta{
		Message: "Account types retrieved successfully",
	}, nil)
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

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	input := appaccount.UpdateAccountInput{
		Name:    req.Name,
		Balance: req.Balance,
		Notes:   req.Notes,
	}

	acc, err := h.accountService.UpdateAccount(r.Context(), id, userID, input)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "UPDATE_FAILED", "Failed to Update Account", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, acc, util.JsonApiMeta{
		Message: "Account updated successfully",
	}, nil)
}

func (h *AccountHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	id, ok := util.ParseUUID(w, idStr)
	if !ok {
		return
	}

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	err := h.accountService.DeleteAccount(r.Context(), id, userID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "DELETE_FAILED", "Failed to Delete Account", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, map[string]string{"message": "Account deleted successfully"}, util.JsonApiMeta{
		Message: "Account deleted successfully",
	}, nil)
}
