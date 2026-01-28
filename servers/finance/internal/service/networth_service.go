package service

import (
	"context"
	"fmt"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/repository"
	"github.com/google/uuid"
)

type NetworthService interface {
	GetCurrentNetworth(ctx context.Context, userID uuid.UUID, currency string) (*model.NetworthHistory, error)
	GetNetworthHistory(ctx context.Context, userID uuid.UUID, currency string, from, to time.Time) ([]*model.NetworthHistory, error)
	RecordNetworth(ctx context.Context, userID uuid.UUID, currency string) (*model.NetworthHistory, error)
}

type networthService struct {
	assetRepo     repository.AssetRepository
	liabilityRepo repository.LiabilityRepository
	networthRepo  repository.NetworthRepository
}

func NewNetworthService(
	assetRepo repository.AssetRepository,
	liabilityRepo repository.LiabilityRepository,
	networthRepo repository.NetworthRepository,
) NetworthService {
	return &networthService{
		assetRepo:     assetRepo,
		liabilityRepo: liabilityRepo,
		networthRepo:  networthRepo,
	}
}

func (s *networthService) GetCurrentNetworth(ctx context.Context, userID uuid.UUID, currency string) (*model.NetworthHistory, error) {
	totalAssets, err := s.assetRepo.SumByUserAndCurrency(ctx, userID, currency)
	if err != nil {
		return nil, fmt.Errorf("failed to sum assets: %w", err)
	}

	totalLiabilities, err := s.liabilityRepo.SumByUserAndCurrency(ctx, userID, currency)
	if err != nil {
		return nil, fmt.Errorf("failed to sum liabilities: %w", err)
	}

	return &model.NetworthHistory{
		Time:             time.Now(),
		UserID:           userID,
		TotalAssets:      totalAssets,
		TotalLiabilities: totalLiabilities,
		Networth:         totalAssets - totalLiabilities,
		Currency:         currency,
	}, nil
}

func (s *networthService) GetNetworthHistory(ctx context.Context, userID uuid.UUID, currency string, from, to time.Time) ([]*model.NetworthHistory, error) {
	return s.networthRepo.GetHistory(ctx, userID, currency, from, to)
}

func (s *networthService) RecordNetworth(ctx context.Context, userID uuid.UUID, currency string) (*model.NetworthHistory, error) {
	record, err := s.GetCurrentNetworth(ctx, userID, currency)
	if err != nil {
		return nil, err
	}

	if err := s.networthRepo.Insert(ctx, record); err != nil {
		return nil, fmt.Errorf("failed to record networth: %w", err)
	}

	return record, nil
}
