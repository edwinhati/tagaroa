package httphandler

import (
	"net/http"
	"strings"
	"time"

	apptransaction "github.com/edwinhati/tagaroa/servers/finance/internal/application/transaction"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/transaction"
	infrahttp "github.com/edwinhati/tagaroa/servers/finance/internal/infrastructure/http"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/util"
	"github.com/google/uuid"
)

// TransactionHandler handles HTTP requests for transactions
type TransactionHandler struct {
	transactionService *apptransaction.Service
}

// NewTransactionHandler creates a new transaction handler
func NewTransactionHandler(transactionService *apptransaction.Service) *TransactionHandler {
	return &TransactionHandler{
		transactionService: transactionService,
	}
}

// SetupRoutes sets up the transaction routes
func (h *TransactionHandler) SetupRoutes(router *infrahttp.RouterGroup) {
	router.HandleFunc("GET /transactions", h.GetTransactions)
	router.HandleFunc("POST /transactions", h.CreateTransaction)
	router.HandleFunc("GET /transactions/{id}", h.GetTransaction)
	router.HandleFunc("PUT /transactions/{id}", h.UpdateTransaction)
	router.HandleFunc("DELETE /transactions/{id}", h.DeleteTransaction)
	router.HandleFunc("GET /transaction/types", h.GetTransactionTypes)
}

// CreateTransactionRequest represents a request to create a transaction
type CreateTransactionRequest struct {
	Amount       float64  `json:"amount" validate:"required"`
	Date         string   `json:"date" validate:"required"`
	Type         string   `json:"type" validate:"required"`
	Currency     string   `json:"currency" validate:"required"`
	Notes        *string  `json:"notes,omitempty"`
	Files        []string `json:"files,omitempty"`
	AccountID    string   `json:"account_id" validate:"required"`
	BudgetItemID *string  `json:"budget_item_id,omitempty"`
}

// UpdateTransactionRequest represents a request to update a transaction
type UpdateTransactionRequest struct {
	Amount       *float64 `json:"amount,omitempty"`
	Date         *string  `json:"date,omitempty"`
	Type         *string  `json:"type,omitempty"`
	Currency     *string  `json:"currency,omitempty"`
	Notes        *string  `json:"notes,omitempty"`
	Files        []string `json:"files,omitempty"`
	AccountID    *string  `json:"account_id,omitempty"`
	BudgetItemID *string  `json:"budget_item_id,omitempty"`
}

func (h *TransactionHandler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	var req CreateTransactionRequest
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

	txnType := transaction.TransactionType(req.Type)
	if !txnType.IsValid() {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_TYPE", "Invalid Transaction Type", "Type must be income or expense")
		return
	}

	// Parse date
	var date time.Time
	if req.Date != "" {
		parsedDate, err := time.Parse(time.RFC3339, req.Date)
		if err != nil {
			util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_DATE", "Invalid Date", "Date must be in RFC3339 format")
			return
		}
		date = parsedDate
	} else {
		date = time.Now()
	}

	// Parse account ID
	accountID, err := uuid.Parse(req.AccountID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_ACCOUNT_ID", "Invalid Account ID", err.Error())
		return
	}

	// Parse budget item ID if provided
	var budgetItemID *uuid.UUID
	if req.BudgetItemID != nil && *req.BudgetItemID != "" {
		parsedID, err := uuid.Parse(*req.BudgetItemID)
		if err != nil {
			util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_BUDGET_ITEM_ID", "Invalid Budget Item ID", err.Error())
			return
		}
		budgetItemID = &parsedID
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	input := apptransaction.CreateTransactionInput{
		Amount:       req.Amount,
		Date:         &date,
		Type:         txnType,
		Currency:     currency,
		Notes:        req.Notes,
		Files:        req.Files,
		UserID:       userID,
		AccountID:    accountID,
		BudgetItemID: budgetItemID,
	}

	txn, err := h.transactionService.CreateTransaction(r.Context(), input)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "CREATE_FAILED", "Failed to Create Transaction", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusCreated, txn, util.JsonApiMeta{
		Message: "Transaction created successfully",
	}, nil)
}

func (h *TransactionHandler) GetTransaction(w http.ResponseWriter, r *http.Request) {
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
	txn, err := h.transactionService.GetTransaction(r.Context(), id, userID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Transaction", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, txn, util.JsonApiMeta{
		Message: "Transaction retrieved successfully",
	}, nil)
}

func (h *TransactionHandler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	// Parse query parameters
	page := util.GetQueryInt(r, "page", 1)
	limit := util.GetQueryInt(r, "limit", 10)
	search := r.URL.Query().Get("search")
	orderBy := r.URL.Query().Get("order_by")

	// Extract filters - type (comma-separated for multi-select)
	var types []transaction.TransactionType
	if typeParams := r.URL.Query()["type"]; len(typeParams) > 0 {
		types = parseTransactionTypes(typeParams)
	}

	// Extract filters - account (comma-separated, account names not UUIDs)
	var accounts []string
	if accountParams := r.URL.Query()["account"]; len(accountParams) > 0 {
		accounts = parseStrings(accountParams)
	}

	// Extract filters - category (comma-separated)
	var categories []string
	if categoryParams := r.URL.Query()["category"]; len(categoryParams) > 0 {
		categories = parseStrings(categoryParams)
	}

	// Extract date range filters
	var startDate, endDate *time.Time
	if startDateStr := r.URL.Query().Get("start_date"); startDateStr != "" {
		if d, err := time.Parse("2006-01-02", startDateStr); err == nil {
			startDate = &d
		}
	}
	if endDateStr := r.URL.Query().Get("end_date"); endDateStr != "" {
		if d, err := time.Parse("2006-01-02", endDateStr); err == nil {
			endDate = &d
		}
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	params := transaction.FindManyParams{
		UserID:     userID,
		Page:       page,
		Limit:      limit,
		Search:     search,
		OrderBy:    orderBy,
		Types:      types,
		Accounts:   accounts,
		Categories: categories,
		StartDate:  startDate,
		EndDate:    endDate,
	}

	result, err := h.transactionService.GetTransactions(r.Context(), params)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Transactions", err.Error())
		return
	}

	pagination := util.NewPagination(page, limit, result.Total)

	aggregations := make(util.Aggregations)
	if len(result.TypeAggregations) > 0 {
		aggregations["type"] = mapAggregations(result.TypeAggregations)
	}
	if len(result.CurrencyAggregations) > 0 {
		aggregations["currency"] = mapAggregations(result.CurrencyAggregations)
	}
	if len(result.AccountAggregations) > 0 {
		aggregations["account"] = mapAggregations(result.AccountAggregations)
	}
	if len(result.CategoryAggregations) > 0 {
		aggregations["category"] = mapAggregations(result.CategoryAggregations)
	}

	util.WriteJsonApiListResponse(w, r, http.StatusOK, result.Transactions, pagination, &aggregations, "Transactions retrieved successfully")
}

func mapAggregations(results map[string]transaction.AggregationResult) []util.Bucket {
	buckets := make([]util.Bucket, 0, len(results))
	for key, result := range results {
		buckets = append(buckets, util.Bucket{
			Key:   key,
			Count: result.Count,
			Min:   result.Min,
			Max:   result.Max,
			Avg:   result.Avg,
			Sum:   result.Sum,
		})
	}
	return buckets
}

func (h *TransactionHandler) GetTransactionTypes(w http.ResponseWriter, r *http.Request) {
	types := transaction.AllTransactionTypes()
	util.WriteJsonApiResponse(w, r, http.StatusOK, types, util.JsonApiMeta{
		Message: "Transaction types retrieved successfully",
	}, nil)
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

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)

	// Build update input
	input := apptransaction.UpdateTransactionInput{}

	if req.Amount != nil {
		input.Amount = req.Amount
	}
	if req.Date != nil {
		parsedDate, err := time.Parse(time.RFC3339, *req.Date)
		if err != nil {
			util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_DATE", "Invalid Date", "Date must be in RFC3339 format")
			return
		}
		input.Date = &parsedDate
	}
	if req.Type != nil {
		txnType := transaction.TransactionType(*req.Type)
		if !txnType.IsValid() {
			util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_TYPE", "Invalid Transaction Type", "Type must be income or expense")
			return
		}
		input.Type = &txnType
	}
	if req.Currency != nil {
		currency := shared.Currency(*req.Currency)
		if !currency.IsValid() {
			util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_CURRENCY", "Invalid Currency", "Currency must be one of: USD, IDR, EUR, GBP, JPY, SGD")
			return
		}
		input.Currency = &currency
	}
	if req.Notes != nil {
		input.Notes = req.Notes
	}
	if req.Files != nil {
		input.Files = req.Files
	}
	if req.AccountID != nil {
		accountID, err := uuid.Parse(*req.AccountID)
		if err != nil {
			util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_ACCOUNT_ID", "Invalid Account ID", err.Error())
			return
		}
		input.AccountID = &accountID
	}
	if req.BudgetItemID != nil {
		if *req.BudgetItemID == "" {
			input.BudgetItemID = nil
		} else {
			parsedID, err := uuid.Parse(*req.BudgetItemID)
			if err != nil {
				util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_BUDGET_ITEM_ID", "Invalid Budget Item ID", err.Error())
				return
			}
			input.BudgetItemID = &parsedID
		}
	}

	txn, err := h.transactionService.UpdateTransaction(r.Context(), id, userID, input)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "UPDATE_FAILED", "Failed to Update Transaction", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, txn, util.JsonApiMeta{
		Message: "Transaction updated successfully",
	}, nil)
}

func (h *TransactionHandler) DeleteTransaction(w http.ResponseWriter, r *http.Request) {
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
	err := h.transactionService.DeleteTransaction(r.Context(), id, userID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "DELETE_FAILED", "Failed to Delete Transaction", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, map[string]string{"message": "Transaction deleted successfully"}, util.JsonApiMeta{
		Message: "Transaction deleted successfully",
	}, nil)
}

// parseTransactionTypes parses transaction types from query parameter values
func parseTransactionTypes(values []string) []transaction.TransactionType {
	var types []transaction.TransactionType
	for _, v := range values {
		parts := strings.Split(v, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(strings.ToUpper(part))
			if t := transaction.TransactionType(trimmed); t.IsValid() {
				types = append(types, t)
			}
		}
	}
	return types
}

// parseUUIDs parses UUIDs from query parameter values
func parseUUIDs(values []string) []uuid.UUID {
	var uuids []uuid.UUID
	for _, v := range values {
		parts := strings.Split(v, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if u, err := uuid.Parse(trimmed); err == nil {
				uuids = append(uuids, u)
			}
		}
	}
	return uuids
}

// parseStrings parses string values from query parameter values
func parseStrings(values []string) []string {
	var result []string
	for _, v := range values {
		parts := strings.Split(v, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				result = append(result, trimmed)
			}
		}
	}
	return result
}
