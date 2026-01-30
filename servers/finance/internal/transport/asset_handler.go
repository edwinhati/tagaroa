package handler

import (
	"net/http"

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
	log          *zap.SugaredLogger
}

func NewAssetHandler(oidcClient *client.OIDCClient, assetService service.AssetService) *AssetHandler {
	return &AssetHandler{
		oidcClient:   oidcClient,
		assetService: assetService,
		log:          logger.New().With("handler", "asset"),
	}
}

func (h *AssetHandler) SetupRoutes(router *router.Router, middlewares ...func(http.Handler) http.Handler) {
	allMiddlewares := append(middlewares, sharedmiddleware.AuthMiddleware(h.oidcClient))
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
