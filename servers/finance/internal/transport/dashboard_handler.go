package handler

import (
	"net/http"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	sharedmiddleware "github.com/edwinhati/tagaroa/packages/shared/go/middleware"
	"github.com/edwinhati/tagaroa/packages/shared/go/router"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/service"
)

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
	allMiddlewares := append(middlewares, sharedmiddleware.AuthMiddleware(h.oidcClient))
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
