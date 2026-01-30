package handler

import (
	"net/http"

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
	sharedmiddleware "github.com/edwinhati/tagaroa/packages/shared/go/middleware"
	"github.com/edwinhati/tagaroa/packages/shared/go/router"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/middleware"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/service"
	"github.com/google/uuid"
	"go.uber.org/zap"
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
	log            *zap.SugaredLogger
}

func NewAccountHandler(oidcClient *client.OIDCClient, accountService service.AccountService) *AccountHandler {
	return &AccountHandler{
		oidcClient:     oidcClient,
		accountService: accountService,
		log:            logger.New().With("handler", "account"),
	}
}

func (h *AccountHandler) SetupRoutes(router *router.Router, middlewares ...func(http.Handler) http.Handler) {
	// Combine middlewares with auth middleware
	allMiddlewares := append(middlewares, sharedmiddleware.AuthMiddleware(h.oidcClient))

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
	requestID := middleware.GetRequestID(r.Context())

	var req CreateAccountRequest
	if !util.ParseJSONBody(w, r, &req) {
		h.log.Warnw("CreateAccount invalid request body", "request_id", requestID)
		return
	}

	userID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	h.log.Infow("CreateAccount request started", "request_id", requestID, "user_id", userID, "account_type", req.Type, "currency", req.Currency)

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
			h.log.Warnw("CreateAccount invalid account type", "request_id", requestID, "error", err.Error())
			util.WriteErrorResponse(w, http.StatusBadRequest, "Invalid account", err.Error())
		default:
			h.log.Errorw("CreateAccount failed", "request_id", requestID, "error", err.Error())
			util.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to create account", err.Error())
		}
		return
	}

	h.log.Infow("CreateAccount success", "request_id", requestID, "account_id", account.ID, "account_type", account.Type)
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
