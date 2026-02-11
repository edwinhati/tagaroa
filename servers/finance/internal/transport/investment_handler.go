package httphandler

import (
	"net/http"

	appinvestment "github.com/edwinhati/tagaroa/servers/finance/internal/application/investment"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/investment"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	infrahttp "github.com/edwinhati/tagaroa/servers/finance/internal/infrastructure/http"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/util"
)

// InvestmentHandler handles HTTP requests for investments (assets and liabilities)
type InvestmentHandler struct {
	investmentService *appinvestment.Service
}

// NewInvestmentHandler creates a new investment handler
func NewInvestmentHandler(investmentService *appinvestment.Service) *InvestmentHandler {
	return &InvestmentHandler{
		investmentService: investmentService,
	}
}

// SetupRoutes sets up the investment routes
func (h *InvestmentHandler) SetupRoutes(router *infrahttp.RouterGroup) {
	// Asset routes
	router.HandleFunc("GET /investments/assets", h.GetAssets)
	router.HandleFunc("POST /investments/assets", h.CreateAsset)
	router.HandleFunc("GET /investments/assets/{id}", h.GetAsset)
	router.HandleFunc("PUT /investments/assets/{id}/value", h.UpdateAssetValue)
	router.HandleFunc("DELETE /investments/assets/{id}", h.DeleteAsset)
	router.HandleFunc("GET /investments/asset-types", h.GetAssetTypes)

	// Liability routes
	router.HandleFunc("GET /investments/liabilities", h.GetLiabilities)
	router.HandleFunc("POST /investments/liabilities", h.CreateLiability)
	router.HandleFunc("GET /investments/liabilities/{id}", h.GetLiability)
	router.HandleFunc("POST /investments/liabilities/{id}/payment", h.MakeLiabilityPayment)
	router.HandleFunc("DELETE /investments/liabilities/{id}", h.DeleteLiability)
	router.HandleFunc("GET /investments/liability-types", h.GetLiabilityTypes)

	// Net worth route
	router.HandleFunc("GET /investments/net-worth", h.GetNetWorth)
}

// CreateAssetRequest represents a request to create an asset
type CreateAssetRequest struct {
	Name         string  `json:"name" validate:"required"`
	AssetType    string  `json:"asset_type" validate:"required"`
	Value        float64 `json:"value" validate:"required,gt=0"`
	Currency     string  `json:"currency" validate:"required"`
	PurchaseDate *string `json:"purchase_date,omitempty"`
	Notes        *string `json:"notes,omitempty"`
}

// UpdateAssetValueRequest represents a request to update asset value
type UpdateAssetValueRequest struct {
	Value float64 `json:"value" validate:"required,gt=0"`
}

// CreateLiabilityRequest represents a request to create a liability
type CreateLiabilityRequest struct {
	Name          string   `json:"name" validate:"required"`
	LiabilityType string   `json:"liability_type" validate:"required"`
	Amount        float64  `json:"amount" validate:"required,gt=0"`
	Currency      string   `json:"currency" validate:"required"`
	InterestRate  *float64 `json:"interest_rate,omitempty" validate:"omitempty,gte=0,lte=100"`
	DueDate       *string  `json:"due_date,omitempty"`
	Notes         *string  `json:"notes,omitempty"`
}

// MakePaymentRequest represents a request to make a liability payment
type MakePaymentRequest struct {
	Amount float64 `json:"amount" validate:"required,gt=0"`
}

func (h *InvestmentHandler) CreateAsset(w http.ResponseWriter, r *http.Request) {
	var req CreateAssetRequest
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

	assetType := investment.AssetType(req.AssetType)
	if !assetType.IsValid() {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_TYPE", "Invalid Asset Type", "Asset type must be one of: STOCKS, BONDS, MUTUAL_FUND, ETF, REAL_ESTATE, CRYPTO, CASH, OTHER")
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	input := appinvestment.CreateAssetInput{
		Name:      req.Name,
		AssetType: assetType,
		Value:     req.Value,
		Currency:  currency,
		UserID:    userID,
		Notes:     req.Notes,
	}

	asset, err := h.investmentService.CreateAsset(r.Context(), input)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "CREATE_FAILED", "Failed to Create Asset", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusCreated, &asset, util.JsonApiMeta{
		Message: "Asset created successfully",
	}, nil)
}

func (h *InvestmentHandler) GetAsset(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	asset, err := h.investmentService.GetAsset(r.Context(), idStr, userID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusNotFound, "NOT_FOUND", "Asset Not Found", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, &asset, util.JsonApiMeta{
		Message: "Asset retrieved successfully",
	}, nil)
}

func (h *InvestmentHandler) GetAssets(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	assets, err := h.investmentService.GetAssets(r.Context(), userID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Assets", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, &assets, util.JsonApiMeta{
		Message: "Assets retrieved successfully",
	}, nil)
}

func (h *InvestmentHandler) UpdateAssetValue(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")

	var req UpdateAssetValueRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	if err := h.investmentService.UpdateAssetValue(r.Context(), idStr, userID, req.Value); err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "UPDATE_FAILED", "Failed to Update Asset Value", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, map[string]string{"message": "Asset value updated successfully"}, util.JsonApiMeta{
		Message: "Asset value updated successfully",
	}, nil)
}

func (h *InvestmentHandler) DeleteAsset(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	if err := h.investmentService.DeleteAsset(r.Context(), idStr, userID); err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "DELETE_FAILED", "Failed to Delete Asset", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, map[string]string{"message": "Asset deleted successfully"}, util.JsonApiMeta{
		Message: "Asset deleted successfully",
	}, nil)
}

func (h *InvestmentHandler) GetAssetTypes(w http.ResponseWriter, r *http.Request) {
	assetTypes := investment.AllAssetTypes()
	util.WriteJsonApiResponse(w, r, http.StatusOK, &assetTypes, util.JsonApiMeta{
		Message: "Asset types retrieved successfully",
	}, nil)
}

func (h *InvestmentHandler) CreateLiability(w http.ResponseWriter, r *http.Request) {
	var req CreateLiabilityRequest
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

	liabilityType := investment.LiabilityType(req.LiabilityType)
	if !liabilityType.IsValid() {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_TYPE", "Invalid Liability Type", "Liability type must be one of: MORTGAGE, CAR_LOAN, STUDENT_LOAN, CREDIT_CARD, PERSONAL_LOAN, OTHER")
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	input := appinvestment.CreateLiabilityInput{
		Name:          req.Name,
		LiabilityType: liabilityType,
		Amount:        req.Amount,
		Currency:      currency,
		UserID:        userID,
		InterestRate:  req.InterestRate,
		Notes:         req.Notes,
	}

	liability, err := h.investmentService.CreateLiability(r.Context(), input)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "CREATE_FAILED", "Failed to Create Liability", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusCreated, &liability, util.JsonApiMeta{
		Message: "Liability created successfully",
	}, nil)
}

func (h *InvestmentHandler) GetLiability(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	liability, err := h.investmentService.GetLiability(r.Context(), idStr, userID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusNotFound, "NOT_FOUND", "Liability Not Found", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, &liability, util.JsonApiMeta{
		Message: "Liability retrieved successfully",
	}, nil)
}

func (h *InvestmentHandler) GetLiabilities(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	liabilities, err := h.investmentService.GetLiabilities(r.Context(), userID)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "FETCH_FAILED", "Failed to Get Liabilities", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, &liabilities, util.JsonApiMeta{
		Message: "Liabilities retrieved successfully",
	}, nil)
}

func (h *InvestmentHandler) MakeLiabilityPayment(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")

	var req MakePaymentRequest
	if !util.ParseJSONBody(w, r, &req) {
		return
	}

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	if err := h.investmentService.MakeLiabilityPayment(r.Context(), idStr, userID, req.Amount); err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "PAYMENT_FAILED", "Failed to Make Payment", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, map[string]string{"message": "Payment made successfully"}, util.JsonApiMeta{
		Message: "Payment made successfully",
	}, nil)
}

func (h *InvestmentHandler) DeleteLiability(w http.ResponseWriter, r *http.Request) {
	idStr := util.GetPathParam(r, "id")

	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	if err := h.investmentService.DeleteLiability(r.Context(), idStr, userID); err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "DELETE_FAILED", "Failed to Delete Liability", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, map[string]string{"message": "Liability deleted successfully"}, util.JsonApiMeta{
		Message: "Liability deleted successfully",
	}, nil)
}

func (h *InvestmentHandler) GetLiabilityTypes(w http.ResponseWriter, r *http.Request) {
	liabilityTypes := investment.AllLiabilityTypes()
	util.WriteJsonApiResponse(w, r, http.StatusOK, &liabilityTypes, util.JsonApiMeta{
		Message: "Liability types retrieved successfully",
	}, nil)
}

func (h *InvestmentHandler) GetNetWorth(w http.ResponseWriter, r *http.Request) {
	userIDUUID, ok := util.RequireUserID(w, r)
	if !ok {
		return
	}

	currencyStr := r.URL.Query().Get("currency")
	if currencyStr == "" {
		currencyStr = "USD"
	}

	currency := shared.Currency(currencyStr)
	if !currency.IsValid() {
		util.WriteJsonApiError(w, r, http.StatusBadRequest, "INVALID_CURRENCY", "Invalid Currency", "Currency must be one of: USD, IDR, EUR, GBP, JPY, SGD")
		return
	}

	userID := shared.UserIDFromUUID(userIDUUID)
	netWorth, err := h.investmentService.GetNetWorth(r.Context(), userID, currency)
	if err != nil {
		util.WriteJsonApiError(w, r, http.StatusInternalServerError, "CALCULATION_FAILED", "Failed to Calculate Net Worth", err.Error())
		return
	}

	util.WriteJsonApiResponse(w, r, http.StatusOK, &netWorth, util.JsonApiMeta{
		Message: "Net worth calculated successfully",
	}, nil)
}
