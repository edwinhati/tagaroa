package handler

import (
	"net/http"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	sharedmiddleware "github.com/edwinhati/tagaroa/packages/shared/go/middleware"
	"github.com/edwinhati/tagaroa/packages/shared/go/router"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/service"
	"github.com/google/uuid"
)

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
	allMiddlewares := append(middlewares, sharedmiddleware.AuthMiddleware(h.oidcClient))
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
