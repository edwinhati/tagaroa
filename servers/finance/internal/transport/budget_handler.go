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

type UpdateBudgetItemRequest struct {
	Allocation float64    `json:"allocation"`
	Category   string     `json:"category"`
	BudgetID   *uuid.UUID `json:"budget_id"`
}

type BudgetHandler struct {
	oidcClient    *client.OIDCClient
	budgetService service.BudgetService
	log           *zap.SugaredLogger
}

func NewBudgetHandler(oidcClient *client.OIDCClient, budgetService service.BudgetService) *BudgetHandler {
	return &BudgetHandler{
		oidcClient:    oidcClient,
		budgetService: budgetService,
		log:           logger.New().With("handler", "budget"),
	}
}

func (h *BudgetHandler) SetupRoutes(router *router.Router, middlewares ...func(http.Handler) http.Handler) {
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
