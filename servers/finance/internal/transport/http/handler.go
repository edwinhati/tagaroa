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

	// Pagination parameters
	page := httputil.GetQueryInt(r, "page", 1)
	limit := max(5, min(httputil.GetQueryInt(r, "limit", 5), 50))

	// Get ordering preference
	orderBy := r.URL.Query().Get("order_by")
	if orderBy == "" {
		orderBy = "created_at DESC"
	}

	// Get account types (support multiple values)
	var accountTypes []string
	if typeParams := r.URL.Query()["type"]; len(typeParams) > 0 {
		for _, typeParam := range typeParams {
			// Split comma-separated values
			for _, t := range strings.Split(typeParam, ",") {
				if trimmed := strings.TrimSpace(t); trimmed != "" {
					accountTypes = append(accountTypes, trimmed)
				}
			}
		}
	}

	// Get account currencies (support multiple values)
	var accountCurrencies []string
	if currencyParams := r.URL.Query()["currency"]; len(currencyParams) > 0 {
		for _, currencyParam := range currencyParams {
			// Split comma-separated values
			for _, c := range strings.Split(currencyParam, ",") {
				if trimmed := strings.TrimSpace(c); trimmed != "" {
					accountCurrencies = append(accountCurrencies, trimmed)
				}
			}
		}
	}

	// Get search query
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	params := service.GetAccountsParams{
		UserID:     userID,
		Page:       page,
		Types:      accountTypes,
		Currencies: accountCurrencies,
		Search:     search,
		Limit:      limit,
		OrderBy:    orderBy,
	}

	result, err := h.accountService.GetAccounts(r.Context(), params)
	if err != nil {
		httputil.WriteErrorResponse(w, http.StatusInternalServerError, "Failed to get accounts", err.Error())
		return
	}

	// Create pagination info
	pagination := httputil.NewPagination(page, limit, result.Total)

	// Convert repository aggregations to HTTP aggregations format
	var aggregations *httputil.Aggregations
	if result.TypeAggregations != nil || result.CurrencyAggregations != nil {
		aggregationsMap := make(httputil.Aggregations)

		// Convert type aggregations
		if result.TypeAggregations != nil {
			var typeBuckets []httputil.Bucket
			for key, agg := range result.TypeAggregations {
				bucket := httputil.Bucket{
					Key:   key,
					Count: agg.Count,
					Min:   agg.Min,
					Max:   agg.Max,
					Avg:   agg.Avg,
					Sum:   agg.Sum,
				}
				typeBuckets = append(typeBuckets, bucket)
			}
			if len(typeBuckets) > 0 {
				aggregationsMap["type"] = typeBuckets
			}
		}

		// Convert currency aggregations
		if result.CurrencyAggregations != nil {
			var currencyBuckets []httputil.Bucket
			for key, agg := range result.CurrencyAggregations {
				bucket := httputil.Bucket{
					Key:   key,
					Count: agg.Count,
					Min:   agg.Min,
					Max:   agg.Max,
					Avg:   agg.Avg,
					Sum:   agg.Sum,
				}
				currencyBuckets = append(currencyBuckets, bucket)
			}
			if len(currencyBuckets) > 0 {
				aggregationsMap["currency"] = currencyBuckets
			}
		}

		aggregations = &aggregationsMap

		httputil.WriteListResponse(w, http.StatusOK, result.Accounts, pagination, aggregations, "Accounts retrieved successfully")
	} else {
		// Use the standard paginated response
		httputil.WritePaginatedJSONResponse(w, http.StatusOK, result.Accounts, pagination, "Accounts retrieved successfully")
	}
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
	account, err := h.accountService.UpdateAccount(r.Context(), id, req.Name, req.Currency, req.Notes, req.Balance, req.IsDeleted, userID)
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
