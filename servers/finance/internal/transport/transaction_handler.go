package handler

import (
	"net/http"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
	sharedmiddleware "github.com/edwinhati/tagaroa/packages/shared/go/middleware"
	"github.com/edwinhati/tagaroa/packages/shared/go/router"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/service"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

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
	log                *zap.SugaredLogger
}

func NewTransactionHandler(oidcClient *client.OIDCClient, transactionService service.TransactionService) *TransactionHandler {
	return &TransactionHandler{
		oidcClient:         oidcClient,
		transactionService: transactionService,
		log:                logger.New().With("handler", "transaction"),
	}
}

func (h *TransactionHandler) SetupRoutes(router *router.Router, middlewares ...func(http.Handler) http.Handler) {
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
