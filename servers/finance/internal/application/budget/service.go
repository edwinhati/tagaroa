package budget

import (
	"context"
	"fmt"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/budget"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/edwinhati/tagaroa/servers/finance/internal/event"
	"github.com/google/uuid"
)

// Service orchestrates business use cases for budgets
type Service struct {
	budgetRepo     budget.Repository
	eventPublisher *event.DomainEventPublisher
}

// NewService creates a new budget service
func NewService(
	budgetRepo budget.Repository,
	eventPublisher *event.DomainEventPublisher,
) *Service {
	return &Service{
		budgetRepo:     budgetRepo,
		eventPublisher: eventPublisher,
	}
}

// CreateBudgetInput contains input for creating a budget
type CreateBudgetInput struct {
	Month    int
	Year     int
	Amount   float64
	UserID   shared.UserID
	Currency shared.Currency
}

// CreateBudget creates a new budget
func (s *Service) CreateBudget(ctx context.Context, input CreateBudgetInput) (*budget.Budget, error) {
	// Check if budget already exists for this month/year
	exists, err := s.budgetRepo.Exists(ctx, input.UserID, input.Month, input.Year)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing budget: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("budget already exists for %d/%d", input.Month, input.Year)
	}

	// Create the budget aggregate
	bgt, err := budget.NewBudget(
		input.Month,
		input.Year,
		input.Amount,
		input.UserID,
		input.Currency,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create budget: %w", err)
	}

	// Save to repository
	if err := s.budgetRepo.Save(ctx, bgt); err != nil {
		return nil, fmt.Errorf("failed to save budget: %w", err)
	}

	// Publish domain events
	if s.eventPublisher != nil {
		if err := s.eventPublisher.PublishAggregateEvents(ctx, bgt); err != nil {
			fmt.Printf("Warning: failed to publish events: %v\n", err)
		}
	}

	return bgt, nil
}

// GetBudget retrieves a budget by ID
func (s *Service) GetBudget(ctx context.Context, budgetID string, userID shared.UserID) (*budget.Budget, error) {
	bgt, err := s.budgetRepo.FindByID(ctx, budgetID)
	if err != nil {
		return nil, fmt.Errorf("failed to find budget: %w", err)
	}
	if bgt == nil {
		return nil, fmt.Errorf("budget not found")
	}

	// Verify ownership
	if bgt.UserID() != userID {
		return nil, fmt.Errorf("access denied")
	}

	return bgt, nil
}

// GetBudgetByMonthYear retrieves a budget by month and year
func (s *Service) GetBudgetByMonthYear(ctx context.Context, userID shared.UserID, month, year int) (*budget.Budget, error) {
	bgt, err := s.budgetRepo.FindByMonthYear(ctx, userID, month, year)
	if err != nil {
		return nil, fmt.Errorf("failed to find budget: %w", err)
	}

	return bgt, nil
}

// GetBudgets retrieves all budgets for a user
func (s *Service) GetBudgets(ctx context.Context, userID shared.UserID) ([]*budget.Budget, error) {
	budgets, err := s.budgetRepo.FindByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to find budgets: %w", err)
	}

	return budgets, nil
}

// UpdateAmount updates the total budget amount
func (s *Service) UpdateAmount(ctx context.Context, budgetID string, userID shared.UserID, amount float64) error {
	bgt, err := s.GetBudget(ctx, budgetID, userID)
	if err != nil {
		return err
	}

	if err := bgt.UpdateAmount(amount); err != nil {
		return fmt.Errorf("failed to update amount: %w", err)
	}

	if err := s.budgetRepo.Save(ctx, bgt); err != nil {
		return fmt.Errorf("failed to save budget: %w", err)
	}

	// Publish domain events
	if s.eventPublisher != nil {
		if err := s.eventPublisher.PublishAggregateEvents(ctx, bgt); err != nil {
			fmt.Printf("Warning: failed to publish events: %v\n", err)
		}
	}

	return nil
}

// AddBudgetItem adds a new item to a budget
func (s *Service) AddBudgetItem(ctx context.Context, budgetID string, userID shared.UserID, category string, allocation float64) error {
	bgt, err := s.GetBudget(ctx, budgetID, userID)
	if err != nil {
		return err
	}

	if err := bgt.AddItem(category, allocation); err != nil {
		return fmt.Errorf("failed to add item: %w", err)
	}

	if err := s.budgetRepo.Save(ctx, bgt); err != nil {
		return fmt.Errorf("failed to save budget: %w", err)
	}

	// Publish domain events
	if s.eventPublisher != nil {
		if err := s.eventPublisher.PublishAggregateEvents(ctx, bgt); err != nil {
			fmt.Printf("Warning: failed to publish events: %v\n", err)
		}
	}

	return nil
}

// RemoveBudgetItem removes an item from a budget
func (s *Service) RemoveBudgetItem(ctx context.Context, budgetID string, userID shared.UserID, itemID uuid.UUID) error {
	bgt, err := s.GetBudget(ctx, budgetID, userID)
	if err != nil {
		return err
	}

	if err := bgt.RemoveItem(itemID); err != nil {
		return fmt.Errorf("failed to remove item: %w", err)
	}

	if err := s.budgetRepo.Save(ctx, bgt); err != nil {
		return fmt.Errorf("failed to save budget: %w", err)
	}

	// Publish domain events
	if s.eventPublisher != nil {
		if err := s.eventPublisher.PublishAggregateEvents(ctx, bgt); err != nil {
			fmt.Printf("Warning: failed to publish events: %v\n", err)
		}
	}

	return nil
}

// UpdateItemAllocation updates a budget item's allocation
func (s *Service) UpdateItemAllocation(ctx context.Context, budgetID string, userID shared.UserID, itemID uuid.UUID, allocation float64) error {
	bgt, err := s.GetBudget(ctx, budgetID, userID)
	if err != nil {
		return err
	}

	if err := bgt.UpdateAllocation(itemID, allocation); err != nil {
		return fmt.Errorf("failed to update allocation: %w", err)
	}

	if err := s.budgetRepo.Save(ctx, bgt); err != nil {
		return fmt.Errorf("failed to save budget: %w", err)
	}

	// Publish domain events
	if s.eventPublisher != nil {
		if err := s.eventPublisher.PublishAggregateEvents(ctx, bgt); err != nil {
			fmt.Printf("Warning: failed to publish events: %v\n", err)
		}
	}

	return nil
}

// UpdateItemSpending updates a budget item's spent amount
func (s *Service) UpdateItemSpending(ctx context.Context, budgetID string, userID shared.UserID, itemID uuid.UUID, spent float64) error {
	bgt, err := s.GetBudget(ctx, budgetID, userID)
	if err != nil {
		return err
	}

	if err := bgt.UpdateSpending(itemID, spent); err != nil {
		return fmt.Errorf("failed to update spending: %w", err)
	}

	if err := s.budgetRepo.Save(ctx, bgt); err != nil {
		return fmt.Errorf("failed to save budget: %w", err)
	}

	// Publish domain events
	if s.eventPublisher != nil {
		if err := s.eventPublisher.PublishAggregateEvents(ctx, bgt); err != nil {
			fmt.Printf("Warning: failed to publish events: %v\n", err)
		}
	}

	return nil
}

// DeleteBudget soft-deletes a budget
func (s *Service) DeleteBudget(ctx context.Context, budgetID string, userID shared.UserID) error {
	bgt, err := s.GetBudget(ctx, budgetID, userID)
	if err != nil {
		return err
	}

	if err := bgt.SoftDelete(); err != nil {
		return fmt.Errorf("failed to delete budget: %w", err)
	}

	if err := s.budgetRepo.Save(ctx, bgt); err != nil {
		return fmt.Errorf("failed to save budget: %w", err)
	}

	// Publish domain events
	if s.eventPublisher != nil {
		if err := s.eventPublisher.PublishAggregateEvents(ctx, bgt); err != nil {
			fmt.Printf("Warning: failed to publish events: %v\n", err)
		}
	}

	return nil
}

// GetCategories returns the default budget categories

// GetCategories returns the default budget categories
func (s *Service) GetCategories() []budget.BudgetCategory {
	return budget.GetDefaultCategories()
}
