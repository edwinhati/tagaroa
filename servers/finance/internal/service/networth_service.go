package service

import (
	"context"
	"fmt"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/repository"
	"github.com/google/uuid"
	"go.uber.org/zap"
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
	logger        *zap.SugaredLogger
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
		logger:        logger.New().With("service", "networth"),
	}
}

func (s *networthService) GetCurrentNetworth(ctx context.Context, userID uuid.UUID, currency string) (*model.NetworthHistory, error) {
	s.logger.Infow("getting current networth", "user_id", userID.String(), "currency", currency)

	totalAssets, err := s.assetRepo.SumByUserAndCurrency(ctx, userID, currency)
	if err != nil {
		s.logger.Errorw("failed to sum assets", "error", err)
		return nil, fmt.Errorf("failed to sum assets: %w", err)
	}

	totalLiabilities, err := s.liabilityRepo.SumByUserAndCurrency(ctx, userID, currency)
	if err != nil {
		s.logger.Errorw("failed to sum liabilities", "error", err)
		return nil, fmt.Errorf("failed to sum liabilities: %w", err)
	}

	networth := &model.NetworthHistory{
		Time:             time.Now(),
		UserID:           userID,
		TotalAssets:      totalAssets,
		TotalLiabilities: totalLiabilities,
		Networth:         totalAssets - totalLiabilities,
		Currency:         currency,
	}

	s.logger.Infow("current networth retrieved", "user_id", userID.String(), "currency", currency, "assets", totalAssets, "liabilities", totalLiabilities, "networth", networth.Networth)
	return networth, nil
}

func (s *networthService) GetNetworthHistory(ctx context.Context, userID uuid.UUID, currency string, from, to time.Time) ([]*model.NetworthHistory, error) {
	s.logger.Infow("getting networth history", "user_id", userID.String(), "currency", currency, "from", from, "to", to)

	history, err := s.networthRepo.GetHistory(ctx, userID, currency, from, to)
	if err != nil {
		s.logger.Errorw("failed to get networth history", "error", err)
		return nil, err
	}

	s.logger.Infow("networth history retrieved", "user_id", userID.String(), "currency", currency, "records_count", len(history))
	return history, nil
}

func (s *networthService) RecordNetworth(ctx context.Context, userID uuid.UUID, currency string) (*model.NetworthHistory, error) {
	s.logger.Infow("recording networth", "user_id", userID.String(), "currency", currency)

	record, err := s.GetCurrentNetworth(ctx, userID, currency)
	if err != nil {
		s.logger.Errorw("failed to get current networth for recording", "error", err)
		return nil, err
	}

	if err := s.networthRepo.Insert(ctx, record); err != nil {
		s.logger.Errorw("failed to insert networth record", "error", err)
		return nil, fmt.Errorf("failed to record networth: %w", err)
	}

	s.logger.Infow("networth recorded", "user_id", userID.String(), "currency", currency, "networth", record.Networth)
	return record, nil
}
