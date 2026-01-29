package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/event"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/repository"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

var (
	ErrBudgetAccessDenied          = errors.New("access denied")
	ErrBudgetNotFound              = errors.New("budget not found")
	ErrBudgetItemInvalidAllocation = errors.New("invalid allocation")
	ErrInvalidBudgetItemCategory   = errors.New("invalid budget item category")
)

type GetBudgetsParams struct {
	UserID uuid.UUID
	Page   int
	Limit  int
}

type GetBudgetsResult struct {
	Budgets []*model.Budget
	Total   int
}

type UpdateBudgetInput struct {
	Month    *int
	Year     *int
	Amount   *float64
	Currency *string
}

type BudgetService interface {
	CreateBudget(ctx context.Context, budget *model.Budget) (*model.Budget, error)
	UpdateBudget(ctx context.Context, id uuid.UUID, input UpdateBudgetInput, userID uuid.UUID) (*model.Budget, error)
	GetBudget(ctx context.Context, month, year int, userID uuid.UUID) (*model.Budget, error)
	GetBudgets(ctx context.Context, params GetBudgetsParams) (*GetBudgetsResult, error)
	CreateBudgetItem(ctx context.Context, item *model.BudgetItem) (*model.BudgetItem, error)
	UpdateBudgetItem(ctx context.Context, item *model.BudgetItem, userID uuid.UUID) (*model.BudgetItem, error)
}

type budgetService struct {
	budgetRepo     repository.BudgetRepository
	log            *zap.SugaredLogger
	eventPublisher event.EventPublisher
}

func NewBudgetService(
	budgetRepo repository.BudgetRepository,
) BudgetService {
	return &budgetService{
		budgetRepo:     budgetRepo,
		log:            logger.New().With("service", "budget"),
		eventPublisher: nil,
	}
}

func NewBudgetServiceWithEvents(
	budgetRepo repository.BudgetRepository,
	eventPublisher event.EventPublisher,
) BudgetService {
	return &budgetService{
		budgetRepo:     budgetRepo,
		log:            logger.New().With("service", "budget"),
		eventPublisher: eventPublisher,
	}
}

func (s *budgetService) CreateBudget(ctx context.Context, budget *model.Budget) (*model.Budget, error) {
	if err := s.budgetRepo.Create(ctx, budget); err != nil {
		s.log.Errorw("Failed to create budget", "error", err, "user_id", budget.UserID, "month", budget.Month, "year", budget.Year)
		return nil, fmt.Errorf("failed to create budget: %w", err)
	}

	categories := model.BudgetCategories()

	for _, category := range categories {
		item := &model.BudgetItem{
			BudgetID:   &budget.ID,
			Category:   category.Name,
			Allocation: 0,
		}

		if _, err := s.CreateBudgetItem(ctx, item); err != nil {
			s.log.Errorw("Failed to create budget item", "error", err, "budget_id", budget.ID, "category", category.Name)
			return nil, fmt.Errorf("failed to create budget item: %w", err)
		}
	}

	s.log.Infow("Budget created", "budget_id", budget.ID, "user_id", budget.UserID, "month", budget.Month, "year", budget.Year)

	if s.eventPublisher != nil {
		budgetEvent := event.NewEvent(event.EventBudgetCreated, budget.UserID.String()).
			WithPayload("budget_id", budget.ID.String()).
			WithPayload("amount", budget.Amount).
			WithPayload("currency", budget.Currency).
			WithPayload("month", budget.Month).
			WithPayload("year", budget.Year).
			Build()

		if err := s.eventPublisher.Publish(ctx, budgetEvent); err != nil {
			s.log.Errorw("Failed to publish budget.created event", "error", err, "budget_id", budget.ID)
		}
	}

	return budget, nil
}

func (s *budgetService) UpdateBudget(ctx context.Context, id uuid.UUID, input UpdateBudgetInput, userID uuid.UUID) (*model.Budget, error) {
	budget, err := s.budgetRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{
			"id":      id,
			"user_id": userID,
		},
	})
	if err != nil {
		s.log.Errorw("Failed to get budget for update", "error", err, "budget_id", id)
		return nil, fmt.Errorf("failed to get budget: %w", err)
	}
	if budget == nil {
		s.log.Debugw("Budget not found for update", "budget_id", id)
		return nil, ErrBudgetNotFound
	}

	if input.Month != nil {
		budget.Month = *input.Month
	}
	if input.Year != nil {
		budget.Year = *input.Year
	}
	if input.Amount != nil {
		budget.Amount = *input.Amount
	}
	if input.Currency != nil {
		budget.Currency = *input.Currency
	}

	if err := s.budgetRepo.Update(ctx, budget); err != nil {
		s.log.Errorw("Failed to update budget", "error", err, "budget_id", id)
		return nil, fmt.Errorf("failed to update budget: %w", err)
	}

	if s.eventPublisher != nil {
		updateEvent := event.NewEvent(event.EventBudgetUpdated, budget.UserID.String()).
			WithPayload("budget_id", budget.ID.String()).
			WithPayload("amount", budget.Amount).
			WithPayload("currency", budget.Currency).
			WithPayload("month", budget.Month).
			WithPayload("year", budget.Year).
			Build()

		if err := s.eventPublisher.Publish(ctx, updateEvent); err != nil {
			s.log.Errorw("Failed to publish budget.updated event", "error", err, "budget_id", budget.ID)
		}
	}

	s.log.Infow("Budget updated", "budget_id", id)
	return budget, nil
}

func (s *budgetService) GetBudget(ctx context.Context, month, year int, userID uuid.UUID) (*model.Budget, error) {
	params := util.FindUniqueParams{
		Where: map[string]any{
			"month":   month,
			"year":    year,
			"user_id": userID,
		},
	}

	budget, err := s.budgetRepo.FindUnique(ctx, params)
	if err != nil {
		s.log.Errorw("Failed to get budget", "error", err, "user_id", userID, "month", month, "year", year)
		return nil, fmt.Errorf("failed to get budget: %w", err)
	}

	if budget == nil {
		s.log.Debugw("Budget not found", "user_id", userID, "month", month, "year", year)
		return nil, ErrBudgetNotFound
	}

	if len(budget.BudgetItems) > 0 {
		budgetItemIDs := make([]uuid.UUID, len(budget.BudgetItems))
		for i, item := range budget.BudgetItems {
			budgetItemIDs[i] = item.ID
		}

		spentMap, err := s.budgetRepo.GetBudgetItemsSpent(ctx, budgetItemIDs)
		if err != nil {
			s.log.Errorw("Failed to get budget items spent", "error", err, "budget_id", budget.ID)
			return nil, fmt.Errorf("failed to get budget items spent: %w", err)
		}

		for i := range budget.BudgetItems {
			budget.BudgetItems[i].Spent = spentMap[budget.BudgetItems[i].ID]
		}
	}

	s.log.Debugw("Budget retrieved", "budget_id", budget.ID, "month", month, "year", year)
	return budget, nil
}

func (s *budgetService) GetBudgets(ctx context.Context, params GetBudgetsParams) (*GetBudgetsResult, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 {
		params.Limit = 10
	}
	offset := (params.Page - 1) * params.Limit

	whereClause := map[string]any{
		"user_id": params.UserID,
	}

	total, err := s.budgetRepo.Count(ctx, whereClause)
	if err != nil {
		s.log.Errorw("Failed to count budgets", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to count user budgets: %w", err)
	}

	repoParams := util.FindManyParams{
		Offset: offset,
		Limit:  params.Limit,
		Where:  whereClause,
	}

	budgets, err := s.budgetRepo.FindMany(ctx, repoParams)
	if err != nil {
		s.log.Errorw("Failed to get budgets", "error", err, "user_id", params.UserID)
		return nil, fmt.Errorf("failed to get budgets: %w", err)
	}

	s.log.Infow("Budgets retrieved", "user_id", params.UserID, "count", len(budgets), "total", total)
	return &GetBudgetsResult{
		Budgets: budgets,
		Total:   total,
	}, nil
}

func (s *budgetService) CreateBudgetItem(ctx context.Context, item *model.BudgetItem) (*model.BudgetItem, error) {
	if err := s.budgetRepo.CreateItem(ctx, item); err != nil {
		s.log.Errorw("Failed to create budget item", "error", err, "budget_id", item.BudgetID, "category", item.Category)
		return nil, fmt.Errorf("failed to create budget item: %w", err)
	}
	s.log.Debugw("Budget item created", "item_id", item.ID, "budget_id", item.BudgetID, "category", item.Category)
	return item, nil
}

func (s *budgetService) UpdateBudgetItem(ctx context.Context, item *model.BudgetItem, userID uuid.UUID) (*model.BudgetItem, error) {
	if item.BudgetID == nil {
		s.log.Warnw("Budget item has no budget_id", "item_id", item.ID)
		return nil, ErrBudgetNotFound
	}

	budget, err := s.budgetRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{
			"id":      *item.BudgetID,
			"user_id": userID,
		},
	})
	if err != nil {
		s.log.Errorw("Failed to verify budget ownership", "error", err, "budget_id", *item.BudgetID)
		return nil, fmt.Errorf("failed to verify budget ownership: %w", err)
	}
	if budget == nil {
		s.log.Warnw("Budget access denied", "budget_id", *item.BudgetID, "user_id", userID)
		return nil, ErrBudgetAccessDenied
	}

	if err := s.budgetRepo.UpdateItem(ctx, item); err != nil {
		s.log.Errorw("Failed to update budget item", "error", err, "item_id", item.ID)
		return nil, fmt.Errorf("failed to update budget item: %w", err)
	}

	s.log.Infow("Budget item updated", "item_id", item.ID)
	return item, nil
}
