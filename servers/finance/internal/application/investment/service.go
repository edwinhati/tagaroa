package investment

import (
	"context"
	"fmt"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/investment"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
)

// Service orchestrates business use cases for investments (assets and liabilities)
type Service struct {
	assetRepo     investment.AssetRepository
	liabilityRepo investment.LiabilityRepository
}

// NewService creates a new investment service
func NewService(
	assetRepo investment.AssetRepository,
	liabilityRepo investment.LiabilityRepository,
) *Service {
	return &Service{
		assetRepo:     assetRepo,
		liabilityRepo: liabilityRepo,
	}
}

// CreateAssetInput contains input for creating an asset
type CreateAssetInput struct {
	Name         string
	AssetType    investment.AssetType
	Value        float64
	Currency     shared.Currency
	UserID       shared.UserID
	PurchaseDate *string
	Notes        *string
}

// CreateAsset creates a new asset
func (s *Service) CreateAsset(ctx context.Context, input CreateAssetInput) (*investment.Asset, error) {
	// Parse purchase date if provided (TODO: implement date parsing)
	_ = input.PurchaseDate

	asset, err := investment.NewAsset(
		input.Name,
		input.AssetType,
		input.Value,
		input.Currency,
		input.UserID,
		nil, // TODO: convert string to time.Time
		input.Notes,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create asset: %w", err)
	}

	if err := s.assetRepo.Save(ctx, asset); err != nil {
		return nil, fmt.Errorf("failed to save asset: %w", err)
	}

	return asset, nil
}

// GetAssets retrieves all assets for a user
func (s *Service) GetAssets(ctx context.Context, userID shared.UserID) ([]*investment.Asset, error) {
	assets, err := s.assetRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to find assets: %w", err)
	}

	return assets, nil
}

// GetAsset retrieves an asset by ID
func (s *Service) GetAsset(ctx context.Context, assetID string, userID shared.UserID) (*investment.Asset, error) {
	asset, err := s.assetRepo.FindByID(ctx, assetID)
	if err != nil {
		return nil, fmt.Errorf("failed to find asset: %w", err)
	}
	if asset == nil {
		return nil, fmt.Errorf("asset not found")
	}

	if asset.UserID() != userID {
		return nil, fmt.Errorf("access denied")
	}

	return asset, nil
}

// UpdateAssetValue updates an asset's value
func (s *Service) UpdateAssetValue(ctx context.Context, assetID string, userID shared.UserID, value float64) error {
	asset, err := s.GetAsset(ctx, assetID, userID)
	if err != nil {
		return err
	}

	if err := asset.UpdateValue(value); err != nil {
		return fmt.Errorf("failed to update value: %w", err)
	}

	if err := s.assetRepo.Save(ctx, asset); err != nil {
		return fmt.Errorf("failed to save asset: %w", err)
	}

	return nil
}

// DeleteAsset soft-deletes an asset
func (s *Service) DeleteAsset(ctx context.Context, assetID string, userID shared.UserID) error {
	asset, err := s.GetAsset(ctx, assetID, userID)
	if err != nil {
		return err
	}

	if err := asset.SoftDelete(); err != nil {
		return fmt.Errorf("failed to delete asset: %w", err)
	}

	if err := s.assetRepo.Save(ctx, asset); err != nil {
		return fmt.Errorf("failed to save asset: %w", err)
	}

	return nil
}

// CreateLiabilityInput contains input for creating a liability
type CreateLiabilityInput struct {
	Name          string
	LiabilityType investment.LiabilityType
	Amount        float64
	Currency      shared.Currency
	UserID        shared.UserID
	InterestRate  *float64
	DueDate       *string
	Notes         *string
}

// CreateLiability creates a new liability
func (s *Service) CreateLiability(ctx context.Context, input CreateLiabilityInput) (*investment.Liability, error) {
	liability, err := investment.NewLiability(
		input.Name,
		input.LiabilityType,
		input.Amount,
		input.Currency,
		input.UserID,
		input.InterestRate,
		nil, // TODO: convert string to time.Time
		input.Notes,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create liability: %w", err)
	}

	if err := s.liabilityRepo.Save(ctx, liability); err != nil {
		return nil, fmt.Errorf("failed to save liability: %w", err)
	}

	return liability, nil
}

// GetLiabilities retrieves all liabilities for a user
func (s *Service) GetLiabilities(ctx context.Context, userID shared.UserID) ([]*investment.Liability, error) {
	liabilities, err := s.liabilityRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to find liabilities: %w", err)
	}

	return liabilities, nil
}

// GetLiability retrieves a liability by ID
func (s *Service) GetLiability(ctx context.Context, liabilityID string, userID shared.UserID) (*investment.Liability, error) {
	liability, err := s.liabilityRepo.FindByID(ctx, liabilityID)
	if err != nil {
		return nil, fmt.Errorf("failed to find liability: %w", err)
	}
	if liability == nil {
		return nil, fmt.Errorf("liability not found")
	}

	if liability.UserID() != userID {
		return nil, fmt.Errorf("access denied")
	}

	return liability, nil
}

// MakeLiabilityPayment makes a payment on a liability
func (s *Service) MakeLiabilityPayment(ctx context.Context, liabilityID string, userID shared.UserID, amount float64) error {
	liability, err := s.GetLiability(ctx, liabilityID, userID)
	if err != nil {
		return err
	}

	if err := liability.MakePayment(amount); err != nil {
		return fmt.Errorf("failed to make payment: %w", err)
	}

	if err := s.liabilityRepo.Save(ctx, liability); err != nil {
		return fmt.Errorf("failed to save liability: %w", err)
	}

	return nil
}

// DeleteLiability soft-deletes a liability
func (s *Service) DeleteLiability(ctx context.Context, liabilityID string, userID shared.UserID) error {
	liability, err := s.GetLiability(ctx, liabilityID, userID)
	if err != nil {
		return err
	}

	if err := liability.SoftDelete(); err != nil {
		return fmt.Errorf("failed to delete liability: %w", err)
	}

	if err := s.liabilityRepo.Save(ctx, liability); err != nil {
		return fmt.Errorf("failed to save liability: %w", err)
	}

	return nil
}

// GetNetWorth calculates and returns the net worth for a user
func (s *Service) GetNetWorth(ctx context.Context, userID shared.UserID, currency shared.Currency) (*investment.NetWorth, error) {
	// Get assets and liabilities
	assets, err := s.assetRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get assets: %w", err)
	}

	liabilities, err := s.liabilityRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get liabilities: %w", err)
	}

	// Calculate net worth
	netWorth := investment.CalculateNetWorth(userID, assets, liabilities, currency)

	return netWorth, nil
}
