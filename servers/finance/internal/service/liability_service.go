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
	ErrLiabilityNotFound    = errors.New("liability not found")
	ErrInvalidLiabilityType = errors.New("invalid liability type")
)

type GetLiabilitiesParams struct {
	UserID     uuid.UUID
	Page       int
	Limit      int
	Types      []string
	Currencies []string
	OrderBy    string
}

type GetLiabilitiesResult struct {
	Liabilities []*model.Liability
	Total       int
}

type UpdateLiabilityInput struct {
	Name      *string
	Type      *model.LiabilityType
	Amount    *float64
	Currency  *string
	PaidAt    *time.Time
	Notes     *string
	DeletedAt *time.Time
}

type LiabilityService interface {
	CreateLiability(ctx context.Context, liability *model.Liability) (*model.Liability, error)
	GetLiability(ctx context.Context, id, userID uuid.UUID) (*model.Liability, error)
	GetLiabilities(ctx context.Context, params GetLiabilitiesParams) (*GetLiabilitiesResult, error)
	UpdateLiability(ctx context.Context, id uuid.UUID, input UpdateLiabilityInput, userID uuid.UUID) (*model.Liability, error)
	DeleteLiability(ctx context.Context, id, userID uuid.UUID) error
}

type liabilityService struct {
	liabilityRepo repository.LiabilityRepository
	logger        *zap.SugaredLogger
}

func NewLiabilityService(liabilityRepo repository.LiabilityRepository) LiabilityService {
	return &liabilityService{
		liabilityRepo: liabilityRepo,
		logger:        logger.New().With("service", "liability"),
	}
}

func (s *liabilityService) CreateLiability(ctx context.Context, liability *model.Liability) (*model.Liability, error) {
	s.logger.Infow("creating liability", "user_id", liability.UserID.String(), "type", string(liability.Type))

	if !isValidLiabilityType(liability.Type) {
		s.logger.Warnw("invalid liability type", "type", string(liability.Type))
		return nil, ErrInvalidLiabilityType
	}
	if err := s.liabilityRepo.Create(ctx, liability); err != nil {
		s.logger.Errorw("failed to create liability", "error", err)
		return nil, fmt.Errorf("failed to create liability: %w", err)
	}
	s.logger.Infow("liability created", "liability_id", liability.ID.String())
	return liability, nil
}

func (s *liabilityService) GetLiability(ctx context.Context, id, userID uuid.UUID) (*model.Liability, error) {
	s.logger.Infow("getting liability", "liability_id", id.String(), "user_id", userID.String())

	liability, err := s.liabilityRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"id": id, "user_id": userID},
	})
	if err != nil {
		s.logger.Errorw("failed to get liability", "error", err, "liability_id", id.String())
		return nil, fmt.Errorf("failed to get liability: %w", err)
	}
	if liability == nil {
		s.logger.Warnw("liability not found", "liability_id", id.String())
		return nil, ErrLiabilityNotFound
	}
	return liability, nil
}

func (s *liabilityService) GetLiabilities(ctx context.Context, params GetLiabilitiesParams) (*GetLiabilitiesResult, error) {
	s.logger.Infow("getting liabilities", "user_id", params.UserID.String(), "page", params.Page, "limit", params.Limit)

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

	total, err := s.liabilityRepo.Count(ctx, where)
	if err != nil {
		s.logger.Errorw("failed to count liabilities", "error", err)
		return nil, fmt.Errorf("failed to count liabilities: %w", err)
	}

	orderBy := params.OrderBy
	if orderBy == "" {
		orderBy = "created_at DESC"
	}

	liabilities, err := s.liabilityRepo.FindMany(ctx, util.FindManyParams{
		Offset: offset, Limit: params.Limit, Where: where, OrderBy: orderBy,
	})
	if err != nil {
		s.logger.Errorw("failed to get liabilities", "error", err)
		return nil, fmt.Errorf("failed to get liabilities: %w", err)
	}

	s.logger.Infow("liabilities retrieved", "total", total, "returned", len(liabilities))
	return &GetLiabilitiesResult{Liabilities: liabilities, Total: total}, nil
}

func (s *liabilityService) UpdateLiability(ctx context.Context, id uuid.UUID, input UpdateLiabilityInput, userID uuid.UUID) (*model.Liability, error) {
	s.logger.Infow("updating liability", "liability_id", id.String(), "user_id", userID.String())

	liability, err := s.liabilityRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"id": id, "user_id": userID},
	})
	if err != nil {
		s.logger.Errorw("failed to get liability for update", "error", err, "liability_id", id.String())
		return nil, fmt.Errorf("failed to get liability: %w", err)
	}
	if liability == nil {
		s.logger.Warnw("liability not found for update", "liability_id", id.String())
		return nil, ErrLiabilityNotFound
	}

	if input.Name != nil {
		liability.Name = *input.Name
	}
	if input.Type != nil {
		liability.Type = *input.Type
	}
	if input.Amount != nil {
		liability.Amount = *input.Amount
	}
	if input.Currency != nil {
		liability.Currency = *input.Currency
	}
	if input.PaidAt != nil {
		liability.PaidAt = input.PaidAt
	}
	if input.Notes != nil {
		liability.Notes = input.Notes
	}
	if input.DeletedAt != nil {
		liability.DeletedAt = input.DeletedAt
	}

	if err := s.liabilityRepo.Update(ctx, liability); err != nil {
		s.logger.Errorw("failed to update liability", "error", err, "liability_id", id.String())
		return nil, fmt.Errorf("failed to update liability: %w", err)
	}
	s.logger.Infow("liability updated", "liability_id", id.String())
	return liability, nil
}

func (s *liabilityService) DeleteLiability(ctx context.Context, id, userID uuid.UUID) error {
	s.logger.Infow("deleting liability", "liability_id", id.String(), "user_id", userID.String())

	liability, err := s.liabilityRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"id": id, "user_id": userID},
	})
	if err != nil {
		s.logger.Errorw("failed to get liability for delete", "error", err, "liability_id", id.String())
		return fmt.Errorf("failed to get liability: %w", err)
	}
	if liability == nil {
		s.logger.Warnw("liability not found for delete", "liability_id", id.String())
		return ErrLiabilityNotFound
	}

	now := time.Now()
	liability.DeletedAt = &now
	if err := s.liabilityRepo.Update(ctx, liability); err != nil {
		s.logger.Errorw("failed to delete liability", "error", err, "liability_id", id.String())
		return fmt.Errorf("failed to delete liability: %w", err)
	}
	s.logger.Infow("liability deleted", "liability_id", id.String())
	return nil
}

func isValidLiabilityType(t model.LiabilityType) bool {
	return slices.Contains(model.LiabilityTypes(), t)
}
