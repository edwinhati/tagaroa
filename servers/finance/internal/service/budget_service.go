package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/edwinhati/tagaroa/packages/shared/go/kafka"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/repository"
	"github.com/google/uuid"
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
	producer   kafka.Producer
	budgetRepo repository.BudgetRepository
}

func NewBudgetService(
	producer kafka.Producer,
	budgetRepo repository.BudgetRepository,
) BudgetService {
	return &budgetService{
		producer:   producer,
		budgetRepo: budgetRepo,
	}
}

func (s *budgetService) CreateBudget(ctx context.Context, budget *model.Budget) (*model.Budget, error) {
	if err := s.budgetRepo.Create(ctx, budget); err != nil {
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
			return nil, fmt.Errorf("failed to create budget item: %w", err)
		}
	}

	if s.producer != nil {
		msg := kafka.Message{
			Topic: "create-budget-item",
			Key:   []byte(budget.ID.String()),
		}
		if err := s.producer.Publish(ctx, msg); err != nil {
			return nil, fmt.Errorf("failed to publish budget created event: %w", err)
		}
	}

	return budget, nil
}

func (s *budgetService) UpdateBudget(ctx context.Context, id uuid.UUID, input UpdateBudgetInput, userID uuid.UUID) (*model.Budget, error) {
	// First, verify the budget exists and belongs to the user
	budget, err := s.budgetRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{
			"id":      id,
			"user_id": userID,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get budget: %w", err)
	}
	if budget == nil {
		return nil, ErrBudgetNotFound
	}

	// Update only the fields that are provided
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

	// Save the updated budget
	if err := s.budgetRepo.Update(ctx, budget); err != nil {
		return nil, fmt.Errorf("failed to update budget: %w", err)
	}

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
		return nil, fmt.Errorf("failed to get budget: %w", err)
	}

	if budget == nil {
		return nil, ErrBudgetNotFound
	}

	return budget, nil
}

func (s *budgetService) GetBudgets(ctx context.Context, params GetBudgetsParams) (*GetBudgetsResult, error) {
	// Calculate offset from page
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

	// Get total count for pagination
	total, err := s.budgetRepo.Count(ctx, whereClause)
	if err != nil {
		return nil, fmt.Errorf("failed to count user budgets: %w", err)
	}

	repoParams := util.FindManyParams{
		Offset: offset,
		Limit:  params.Limit,
		Where:  whereClause,
	}

	budgets, err := s.budgetRepo.FindMany(ctx, repoParams)
	if err != nil {
		return nil, fmt.Errorf("failed to get budgets: %w", err)
	}

	return &GetBudgetsResult{
		Budgets: budgets,
		Total:   total,
	}, nil
}

func (s *budgetService) CreateBudgetItem(ctx context.Context, item *model.BudgetItem) (*model.BudgetItem, error) {
	if err := s.budgetRepo.CreateItem(ctx, item); err != nil {
		return nil, fmt.Errorf("failed to create budget item: %w", err)
	}

	return item, nil
}

func (s *budgetService) UpdateBudgetItem(ctx context.Context, item *model.BudgetItem, userID uuid.UUID) (*model.BudgetItem, error) {
	// Verify the budget item belongs to the user by checking the budget
	if item.BudgetID == nil {
		return nil, ErrBudgetNotFound
	}

	budget, err := s.budgetRepo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{
			"id":      *item.BudgetID,
			"user_id": userID,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to verify budget ownership: %w", err)
	}
	if budget == nil {
		return nil, ErrBudgetAccessDenied
	}

	if err := s.budgetRepo.UpdateItem(ctx, item); err != nil {
		return nil, fmt.Errorf("failed to update budget item: %w", err)
	}

	return item, nil
}
