package account

import (
	"context"
	"fmt"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/account"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/edwinhati/tagaroa/servers/finance/internal/event"
	"github.com/google/uuid"
)

// Service orchestrates business use cases for accounts
type Service struct {
	accountRepo    account.Repository
	eventPublisher *event.DomainEventPublisher
}

// NewService creates a new account service
func NewService(
	accountRepo account.Repository,
	eventPublisher *event.DomainEventPublisher,
) *Service {
	return &Service{
		accountRepo:    accountRepo,
		eventPublisher: eventPublisher,
	}
}

// CreateAccountInput contains input for creating an account
type CreateAccountInput struct {
	Name           string
	Type           account.AccountType
	InitialBalance float64
	UserID         shared.UserID
	Currency       shared.Currency
	Notes          *string
}

// CreateAccount creates a new account
func (s *Service) CreateAccount(ctx context.Context, input CreateAccountInput) (*account.Account, error) {
	// Create the account aggregate
	acc, err := account.NewAccount(
		input.Name,
		input.Type,
		input.InitialBalance,
		input.UserID,
		input.Currency,
		input.Notes,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create account: %w", err)
	}

	// Save to repository
	if err := s.accountRepo.Save(ctx, acc); err != nil {
		return nil, fmt.Errorf("failed to save account: %w", err)
	}

	// Publish domain events
	if s.eventPublisher != nil {
		if err := s.eventPublisher.PublishAggregateEvents(ctx, acc); err != nil {
			// Log but don't fail the operation if event publishing fails
			fmt.Printf("Warning: failed to publish events: %v\n", err)
		}
	}

	return acc, nil
}

// UpdateAccountInput contains input for updating an account
type UpdateAccountInput struct {
	Name    *string
	Balance *float64
	Notes   *string
}

// UpdateAccount updates an existing account
func (s *Service) UpdateAccount(ctx context.Context, accountID uuid.UUID, userID shared.UserID, input UpdateAccountInput) (*account.Account, error) {
	// Load the account
	acc, err := s.accountRepo.FindByID(ctx, accountID)
	if err != nil {
		return nil, fmt.Errorf("failed to find account: %w", err)
	}
	if acc == nil {
		return nil, fmt.Errorf("account not found")
	}

	// Verify ownership
	if acc.UserID() != userID {
		return nil, fmt.Errorf("access denied")
	}

	// Apply updates
	if input.Name != nil {
		if err := acc.UpdateName(*input.Name); err != nil {
			return nil, fmt.Errorf("failed to update name: %w", err)
		}
	}
	if input.Balance != nil {
		if err := acc.UpdateBalance(*input.Balance); err != nil {
			return nil, fmt.Errorf("failed to update balance: %w", err)
		}
	}
	if input.Notes != nil {
		if err := acc.UpdateNotes(input.Notes); err != nil {
			return nil, fmt.Errorf("failed to update notes: %w", err)
		}
	}

	// Save changes
	if err := s.accountRepo.Save(ctx, acc); err != nil {
		return nil, fmt.Errorf("failed to save account: %w", err)
	}

	// Publish domain events
	if s.eventPublisher != nil {
		if err := s.eventPublisher.PublishAggregateEvents(ctx, acc); err != nil {
			fmt.Printf("Warning: failed to publish events: %v\n", err)
		}
	}

	return acc, nil
}

// CreditAccount credits an account (used by transaction service)
func (s *Service) DeleteAccount(ctx context.Context, accountID uuid.UUID, userID shared.UserID) error {
	// Load the account
	acc, err := s.accountRepo.FindByID(ctx, accountID)
	if err != nil {
		return fmt.Errorf("failed to find account: %w", err)
	}
	if acc == nil {
		return fmt.Errorf("account not found")
	}

	// Verify ownership
	if acc.UserID() != userID {
		return fmt.Errorf("access denied")
	}

	// Soft delete
	if err := acc.SoftDelete(); err != nil {
		return fmt.Errorf("failed to delete account: %w", err)
	}

	// Save changes
	if err := s.accountRepo.Save(ctx, acc); err != nil {
		return fmt.Errorf("failed to save account: %w", err)
	}

	return nil
}

// GetAccount retrieves an account by ID
func (s *Service) GetAccount(ctx context.Context, accountID uuid.UUID, userID shared.UserID) (*account.Account, error) {
	acc, err := s.accountRepo.FindByID(ctx, accountID)
	if err != nil {
		return nil, fmt.Errorf("failed to find account: %w", err)
	}
	if acc == nil {
		return nil, fmt.Errorf("account not found")
	}

	// Verify ownership
	if acc.UserID() != userID {
		return nil, fmt.Errorf("access denied")
	}

	return acc, nil
}

// GetAccounts retrieves all accounts for a user
func (s *Service) GetAccounts(ctx context.Context, userID shared.UserID) ([]*account.Account, error) {
	accounts, err := s.accountRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to find accounts: %w", err)
	}

	return accounts, nil
}

// CreditAccount credits an account (used by transaction service)
func (s *Service) CreditAccount(ctx context.Context, accountID uuid.UUID, amount float64) error {
	acc, err := s.accountRepo.FindByID(ctx, accountID)
	if err != nil {
		return fmt.Errorf("failed to find account: %w", err)
	}
	if acc == nil {
		return fmt.Errorf("account not found")
	}

	if err := acc.Credit(amount); err != nil {
		return fmt.Errorf("failed to credit account: %w", err)
	}

	if err := s.accountRepo.Save(ctx, acc); err != nil {
		return fmt.Errorf("failed to save account: %w", err)
	}

	return nil
}

// DebitAccount debits an account (used by transaction service)
func (s *Service) DebitAccount(ctx context.Context, accountID uuid.UUID, amount float64) error {
	acc, err := s.accountRepo.FindByID(ctx, accountID)
	if err != nil {
		return fmt.Errorf("failed to find account: %w", err)
	}
	if acc == nil {
		return fmt.Errorf("account not found")
	}

	if err := acc.Debit(amount); err != nil {
		return fmt.Errorf("failed to debit account: %w", err)
	}

	if err := s.accountRepo.Save(ctx, acc); err != nil {
		return fmt.Errorf("failed to save account: %w", err)
	}

	return nil
}
