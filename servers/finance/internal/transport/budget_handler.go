package httphandler

import (
	"net/http"
	"strconv"
	"time"

	appbudget "github.com/edwinhati/tagaroa/servers/finance/internal/application/budget"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	infrahttp "github.com/edwinhati/tagaroa/servers/finance/internal/infrastructure/http"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/util"
)

// BudgetHandler handles HTTP requests for budgets
type BudgetHandler struct {
	budgetService *appbudget.Service
}

// NewBudgetHandler creates a new budget handler
func NewBudgetHandler(budgetService *appbudget.Service) *BudgetHandler {
	return &BudgetHandler{
		budgetService: budgetService,
	}
}

// SetupRoutes sets up the budget routes
func (h *BudgetHandler) SetupRoutes(router *infrahttp.RouterGroup) {
	router.HandleFunc("GET /budgets", h.GetBudgets)
	router.HandleFunc("POST /budgets", h.CreateBudget)
	router.HandleFunc("GET /budgets/current", h.GetCurrentBudget)
	router.HandleFunc("GET /budgets/{month}/{year}", h.GetBudgetByMonthYear)
	router.HandleFunc("GET /budgets/{id}", h.GetBudget)
	router.HandleFunc("PUT /budgets/{id}/amount", h.UpdateAmount)
	router.HandleFunc("POST /budgets/{id}/items", h.AddItem)
	router.HandleFunc("DELETE /budgets/{id}/items/{itemId}", h.RemoveItem)
	router.HandleFunc("PUT /budgets/{id}/items/{itemId}/allocation", h.UpdateAllocation)
	router.HandleFunc("PUT /budgets/{id}/items/{itemId}/spending", h.UpdateSpending)
	router.HandleFunc("DELETE /budgets/{id}", h.DeleteBudget)
	router.HandleFunc("GET /budgets/categories", h.GetCategories)
}

// CreateBudgetRequest represents a request to create a budget
type CreateBudgetRequest struct {
	Month    int     `json:"month" validate:"required,min=1,max=12"`
	Year     int     `json:"year" validate:"required,min=2000,max=2100"`
	Amount   float64 `json:"amount" validate:"required,gt=0"`
	Currency string  `json:"currency" validate:"required"`
}

// UpdateAmountRequest represents a request to update budget amount
type UpdateAmountRequest struct {
	Amount float64 `json:"amount" validate:"required,gt=0"`
}

// AddItemRequest represents a request to add a budget item
type AddItemRequest struct {
	Category   string  `json:"category" validate:"required"`
	Allocation float64 `json:"allocation" validate:"required,gt=0"`
}

// UpdateAllocationRequest represents a request to update item allocation
type UpdateAllocationRequest struct {
	Allocation float64 `json:"allocation" validate:"required,gt=0"`
}

// UpdateSpendingRequest represents a request to update item spending
type UpdateSpendingRequest struct {
	Spent float64 `json:"spent" validate:"gte=0"`
}

func (h *BudgetHandler) CreateBudget(w http.ResponseWriter, r *http.Request) {
	var req CreateBudgetRequest
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

	userID := shared.UserIDFromUUID(userIDUUID)
	input := appbudget.CreateBudgetInput{
		Month:    req.Month,
		Year:     req.Year,
		Amount:   req.Amount,
		UserID:   userID,
		Currency: currency,
	}

	bgt, err := h.budgetService.CreateBudget(r.Context(), input)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "CREATE_FAILED", "Failed to Create Budget", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusCreated, bgt, util.JsonApiMeta{
		Message: "Budget created successfully",
	}, nil)
}

func (h *BudgetHandler) GetBudget(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	bgt, err := h.budgetService.GetBudget(r.Context(), idStr, userID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusNotFound, "NOT_FOUND", "Budget Not Found", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, &bgt, util.JsonApiMeta{
		Message: "Budget retrieved successfully",
	}, nil)
}

func (h *BudgetHandler) GetBudgetByMonthYear(w http.ResponseWriter, r *http.Request) {
	monthStr := util.GetPathParam(r, "month")
	yearStr := util.GetPathParam(r, "year")

	month, err := strconv.Atoi(monthStr)
	if err != nil || month < 1 || month > 12 {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_MONTH", "Invalid Month", "Month must be between 1 and 12")
		return
	}

	year, err := strconv.Atoi(yearStr)
	if err != nil || year < 2000 || year > 2100 {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_YEAR", "Invalid Year", "Year must be between 2000 and 2100")
		return
	}

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	bgt, err := h.budgetService.GetBudgetByMonthYear(r.Context(), userID, month, year)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Budget", err.Error())
		return
	}
	if bgt == nil {
		util.WriteJsonApiResponse(w, r, http.StatusOK, (*appbudget.Service)(nil), util.JsonApiMeta{
			Message: "No budget found for this period",
		}, nil)
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, &bgt, util.JsonApiMeta{
		Message: "Budget retrieved successfully",
	}, nil)
}

func (h *BudgetHandler) GetCurrentBudget(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	now := time.Now().UTC()
	month := int(now.Month())
	year := now.Year()

	bgt, err := h.budgetService.GetBudgetByMonthYear(r.Context(), userID, month, year)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Budget", err.Error())
		return
	}
	if bgt == nil {
		util.WriteJsonApiResponse(w, r, http.StatusOK, (*appbudget.Service)(nil), util.JsonApiMeta{
			Message: "No budget found for current period",
		}, nil)
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, &bgt, util.JsonApiMeta{
		Message: "Budget retrieved successfully",
	}, nil)
}

func (h *BudgetHandler) GetBudgets(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	budgets, err := h.budgetService.GetBudgets(r.Context(), userID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Budgets", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, &budgets, util.JsonApiMeta{
		Message: "Budgets retrieved successfully",
	}, nil)
}

func (h *BudgetHandler) UpdateAmount(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")

	var req UpdateAmountRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	if err := h.budgetService.UpdateAmount(r.Context(), idStr, userID, req.Amount); err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "UPDATE_FAILED", "Failed to Update Budget Amount", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, map[string]string{"message": "Budget amount updated successfully"}, util.JsonApiMeta{
		Message: "Budget amount updated successfully",
	}, nil)
}

func (h *BudgetHandler) AddItem(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")

	var req AddItemRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	if err := h.budgetService.AddBudgetItem(r.Context(), idStr, userID, req.Category, req.Allocation); err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "ADD_ITEM_FAILED", "Failed to Add Budget Item", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusCreated, map[string]string{"message": "Budget item added successfully"}, util.JsonApiMeta{
		Message: "Budget item added successfully",
	}, nil)
}

func (h *BudgetHandler) RemoveItem(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	itemIDStr := util.GetPathParam(r, "itemId")

	itemID, ok := util.ParseUUID(w, itemIDStr)
	if !ok {
		return
	}

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	if err := h.budgetService.RemoveBudgetItem(r.Context(), idStr, userID, itemID); err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "REMOVE_ITEM_FAILED", "Failed to Remove Budget Item", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, map[string]string{"message": "Budget item removed successfully"}, util.JsonApiMeta{
		Message: "Budget item removed successfully",
	}, nil)
}

func (h *BudgetHandler) UpdateAllocation(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	itemIDStr := util.GetPathParam(r, "itemId")

	itemID, ok := util.ParseUUID(w, itemIDStr)
	if !ok {
		return
	}

	var req UpdateAllocationRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	if err := h.budgetService.UpdateItemAllocation(r.Context(), idStr, userID, itemID, req.Allocation); err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "UPDATE_ALLOCATION_FAILED", "Failed to Update Allocation", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, map[string]string{"message": "Allocation updated successfully"}, util.JsonApiMeta{
		Message: "Allocation updated successfully",
	}, nil)
}

func (h *BudgetHandler) UpdateSpending(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")
	itemIDStr := util.GetPathParam(r, "itemId")

	itemID, ok := util.ParseUUID(w, itemIDStr)
	if !ok {
		return
	}

	var req UpdateSpendingRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	if err := h.budgetService.UpdateItemSpending(r.Context(), idStr, userID, itemID, req.Spent); err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "UPDATE_SPENDING_FAILED", "Failed to Update Spending", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, map[string]string{"message": "Spending updated successfully"}, util.JsonApiMeta{
		Message: "Spending updated successfully",
	}, nil)
}

func (h *BudgetHandler) DeleteBudget(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	if err := h.budgetService.DeleteBudget(r.Context(), idStr, userID); err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "DELETE_FAILED", "Failed to Delete Budget", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, map[string]string{"message": "Budget deleted successfully"}, util.JsonApiMeta{
		Message: "Budget deleted successfully",
	}, nil)
}

func (h *BudgetHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	categories := h.budgetService.GetCategories()
	util.WriteJsonApiResponse(w, r, http.StatusOK, categories, util.JsonApiMeta{
		Message: "Categories retrieved successfully",
	}, nil)
}
