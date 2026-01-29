package service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/repository"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

var (
	ErrAssetNotFound    = errors.New("asset not found")
	ErrInvalidAssetType = errors.New("invalid asset type")
)

type GetAssetsParams struct {
	UserID     uuid.UUID
	Page       int
	Limit      int
	Types      []string
	Currencies []string
	OrderBy    string
}

type GetAssetsResult struct {
	Assets []*model.Asset
	Total  int
}

type UpdateAssetInput struct {
	Name      *string
	Type      *model.AssetType
	Value     *float64
	Shares    *float64
	Ticker    *string
	Currency  *string
	Notes     *string
	DeletedAt *time.Time
}

type AssetService interface {
	CreateAsset(ctx context.Context, asset *model.Asset) (*model.Asset, error)
	GetAsset(ctx context.Context, id, userID uuid.UUID) (*model.Asset, error)
	GetAssets(ctx context.Context, params GetAssetsParams) (*GetAssetsResult, error)
	UpdateAsset(ctx context.Context, id uuid.UUID, input UpdateAssetInput, userID uuid.UUID) (*model.Asset, error)
	DeleteAsset(ctx context.Context, id, userID uuid.UUID) error
}

type assetService struct {
	assetRepo repository.AssetRepository
	log       *zap.SugaredLogger
}

func NewAssetService(assetRepo repository.AssetRepository) AssetService {
	return &assetService{
		assetRepo: assetRepo,
		log:       logger.New().With("service", "asset"),
	}
}

func (s *assetService) CreateAsset(ctx context.Context, asset *model.Asset) (*model.Asset, error) {
	if !isValidAssetType(asset.Type) {
		s.log.Warnw("Invalid asset type", "type", asset.Type)
		return nil, ErrInvalidAssetType
	}
	if err := s.assetRepo.Create(ctx, asset); err != nil {
		s.log.Errorw("Failed to create asset", "error", err, "user_id", asset.UserID)
		return nil, fmt.Errorf("failed to create asset: %w", err)
	}
	s.log.Infow("Asset created", "asset_id", asset.ID, "user_id", asset.UserID, "type", asset.Type)
	return asset, nil
}

func (s *assetService) GetAsset(ctx context.Context, id, userID uuid.UUID) (*model.Asset, error) {
	asset, err := s.assetRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"id": id, "user_id": userID},
	})
	if err != nil {
		s.log.Errorw("Failed to get asset", "error", err, "asset_id", id)
		return nil, fmt.Errorf("failed to get asset: %w", err)
	}
	if asset == nil {
		s.log.Debugw("Asset not found", "asset_id", id)
		return nil, ErrAssetNotFound
	}
	s.log.Debugw("Asset found", "asset_id", id)
	return asset, nil
}

func (s *assetService) GetAssets(ctx context.Context, params GetAssetsParams) (*GetAssetsResult, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 {
		params.Limit = 10
	}
	offset := (params.Page - 1) * params.Limit

	where := map[string]any{"user_id": params.UserID}
	if len(params.Types) > 0 {
		where["type"] = params.Types
	}
	if len(params.Currencies) > 0 {
		where["currency"] = params.Currencies
	}

	total, err := s.assetRepo.Count(ctx, where)
	if err != nil {
		s.log.Errorw("Failed to count assets", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to count assets: %w", err)
	}

	orderBy := params.OrderBy
	if orderBy == "" {
		orderBy = "created_at DESC"
	}

	assets, err := s.assetRepo.FindMany(ctx, util.FindManyParams{
		Offset: offset, Limit: params.Limit, Where: where, OrderBy: orderBy,
	})
	if err != nil {
		s.log.Errorw("Failed to get assets", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to get assets: %w", err)
	}

	s.log.Infow("Assets retrieved", "user_id", params.UserID, "count", len(assets), "total", total)
	return &GetAssetsResult{Assets: assets, Total: total}, nil
}

func (s *assetService) UpdateAsset(ctx context.Context, id uuid.UUID, input UpdateAssetInput, userID uuid.UUID) (*model.Asset, error) {
	asset, err := s.assetRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"id": id, "user_id": userID},
	})
	if err != nil {
		s.log.Errorw("Failed to get asset for update", "error", err, "asset_id", id)
		return nil, fmt.Errorf("failed to get asset: %w", err)
	}
	if asset == nil {
		s.log.Debugw("Asset not found for update", "asset_id", id)
		return nil, ErrAssetNotFound
	}

	if input.Name != nil {
		asset.Name = *input.Name
	}
	if input.Type != nil {
		asset.Type = *input.Type
	}
	if input.Value != nil {
		asset.Value = *input.Value
	}
	if input.Shares != nil {
		asset.Shares = input.Shares
	}
	if input.Ticker != nil {
		asset.Ticker = input.Ticker
	}
	if input.Currency != nil {
		asset.Currency = *input.Currency
	}
	if input.Notes != nil {
		asset.Notes = input.Notes
	}
	if input.DeletedAt != nil {
		asset.DeletedAt = input.DeletedAt
	}

	if err := s.assetRepo.Update(ctx, asset); err != nil {
		s.log.Errorw("Failed to update asset", "error", err, "asset_id", id)
		return nil, fmt.Errorf("failed to update asset: %w", err)
	}
	s.log.Infow("Asset updated", "asset_id", id)
	return asset, nil
}

func (s *assetService) DeleteAsset(ctx context.Context, id, userID uuid.UUID) error {
	asset, err := s.assetRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"id": id, "user_id": userID},
	})
	if err != nil {
		s.log.Errorw("Failed to get asset for delete", "error", err, "asset_id", id)
		return fmt.Errorf("failed to get asset: %w", err)
	}
	if asset == nil {
		s.log.Debugw("Asset not found for delete", "asset_id", id)
		return ErrAssetNotFound
	}

	now := time.Now()
	asset.DeletedAt = &now
	if err := s.assetRepo.Update(ctx, asset); err != nil {
		s.log.Errorw("Failed to delete asset", "error", err, "asset_id", id)
		return fmt.Errorf("failed to delete asset: %w", err)
	}
	s.log.Infow("Asset deleted", "asset_id", id)
	return nil
}

func isValidAssetType(t model.AssetType) bool {
	return slices.Contains(model.AssetTypes(), t)
}
