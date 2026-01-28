package service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/repository"
	"github.com/google/uuid"
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
}

func NewLiabilityService(liabilityRepo repository.LiabilityRepository) LiabilityService {
	return &liabilityService{liabilityRepo: liabilityRepo}
}

func (s *liabilityService) CreateLiability(ctx context.Context, liability *model.Liability) (*model.Liability, error) {
	if !isValidLiabilityType(liability.Type) {
		return nil, ErrInvalidLiabilityType
	}
	if err := s.liabilityRepo.Create(ctx, liability); err != nil {
		return nil, fmt.Errorf("failed to create liability: %w", err)
	}
	return liability, nil
}

func (s *liabilityService) GetLiability(ctx context.Context, id, userID uuid.UUID) (*model.Liability, error) {
	liability, err := s.liabilityRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"id": id, "user_id": userID},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get liability: %w", err)
	}
	if liability == nil {
		return nil, ErrLiabilityNotFound
	}
	return liability, nil
}

func (s *liabilityService) GetLiabilities(ctx context.Context, params GetLiabilitiesParams) (*GetLiabilitiesResult, error) {
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
		return nil, fmt.Errorf("failed to get liabilities: %w", err)
	}

	return &GetLiabilitiesResult{Liabilities: liabilities, Total: total}, nil
}

func (s *liabilityService) UpdateLiability(ctx context.Context, id uuid.UUID, input UpdateLiabilityInput, userID uuid.UUID) (*model.Liability, error) {
	liability, err := s.liabilityRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"id": id, "user_id": userID},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get liability: %w", err)
	}
	if liability == nil {
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
		return nil, fmt.Errorf("failed to update liability: %w", err)
	}
	return liability, nil
}

func (s *liabilityService) DeleteLiability(ctx context.Context, id, userID uuid.UUID) error {
	liability, err := s.liabilityRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"id": id, "user_id": userID},
	})
	if err != nil {
		return fmt.Errorf("failed to get liability: %w", err)
	}
	if liability == nil {
		return ErrLiabilityNotFound
	}

	now := time.Now()
	liability.DeletedAt = &now
	return s.liabilityRepo.Update(ctx, liability)
}

func isValidLiabilityType(t model.LiabilityType) bool {
	return slices.Contains(model.LiabilityTypes(), t)
}
