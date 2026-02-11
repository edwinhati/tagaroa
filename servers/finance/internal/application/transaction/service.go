package transaction

import (
	"context"
	"fmt"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/transaction"
	"github.com/edwinhati/tagaroa/servers/finance/internal/event"
	"github.com/google/uuid"
)

// Service orchestrates business use cases for transactions
type Service struct {
	txnRepo        transaction.Repository
	accountSvc     AccountService
	txnManager     TransactionManager
	eventPublisher *event.DomainEventPublisher
}

// TransactionManager defines the interface for managing database transactions
type TransactionManager interface {
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

// AccountService defines the interface for account operations needed by transaction service
type AccountService interface {
	CreditAccount(ctx context.Context, accountID uuid.UUID, amount float64) error
	DebitAccount(ctx context.Context, accountID uuid.UUID, amount float64) error
}

// NewService creates a new transaction service
func NewService(
	txnRepo transaction.Repository,
	accountSvc AccountService,
	txnManager TransactionManager,
	eventPublisher *event.DomainEventPublisher,
) *Service {
	return &Service{
		txnRepo:        txnRepo,
		accountSvc:     accountSvc,
		txnManager:     txnManager,
		eventPublisher: eventPublisher,
	}
}

// CreateTransactionInput contains input for creating a transaction
type CreateTransactionInput struct {
	Amount       float64
	Date         *time.Time
	Type         transaction.TransactionType
	Currency     shared.Currency
	Notes        *string
	Files        []string
	UserID       shared.UserID
	AccountID    uuid.UUID
	BudgetItemID *uuid.UUID
}

// CreateTransaction creates a new transaction and updates account balance
func (s *Service) CreateTransaction(ctx context.Context, input CreateTransactionInput) (*transaction.Transaction, error) {
	// Create the transaction aggregate
	date := time.Now()
	if input.Date != nil {
		date = *input.Date
	}

	txn, err := transaction.NewTransaction(
		input.Amount,
		date,
		input.Type,
		input.Currency,
		input.Notes,
		input.Files,
		input.UserID,
		input.AccountID,
		input.BudgetItemID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	// Update account balance based on transaction type
	switch input.Type {
	case transaction.TransactionTypeIncome:
		if err := s.accountSvc.CreditAccount(ctx, input.AccountID, input.Amount); err != nil {
			return nil, fmt.Errorf("failed to credit account: %w", err)
		}
	case transaction.TransactionTypeExpense:
		if err := s.accountSvc.DebitAccount(ctx, input.AccountID, input.Amount); err != nil {
			return nil, fmt.Errorf("failed to debit account: %w", err)
		}
	}

	// Save transaction
	if err := s.txnRepo.Save(ctx, txn); err != nil {
		return nil, fmt.Errorf("failed to save transaction: %w", err)
	}

	// Publish domain events
	if s.eventPublisher != nil {
		if err := s.eventPublisher.PublishAggregateEvents(ctx, txn); err != nil {
			fmt.Printf("Warning: failed to publish events: %v\n", err)
		}
	}

	return txn, nil
}

// UpdateTransactionInput contains input for updating a transaction
type UpdateTransactionInput struct {
	Amount       *float64
	Date         *time.Time
	Type         *transaction.TransactionType
	Currency     *shared.Currency
	Notes        *string
	Files        []string
	AccountID    *uuid.UUID
	BudgetItemID *uuid.UUID
}

// UpdateTransaction updates an existing transaction
func (s *Service) UpdateTransaction(ctx context.Context, transactionID uuid.UUID, userID shared.UserID, input UpdateTransactionInput) (*transaction.Transaction, error) {
	var resultTxn *transaction.Transaction

	err := s.txnManager.InTransaction(ctx, func(txCtx context.Context) error {
		// Load the transaction
		txn, err := s.txnRepo.FindByID(txCtx, transactionID)
		if err != nil {
			return fmt.Errorf("failed to find transaction: %w", err)
		}
		if txn == nil {
			return fmt.Errorf("transaction not found")
		}

		// Verify ownership
		if txn.UserID() != userID {
			return fmt.Errorf("access denied")
		}

		// Store old values for balance reversal
		oldAmount := txn.Amount()
		oldType := txn.Type()
		oldAccountID := txn.AccountID()

		// Apply updates
		if input.Amount != nil {
			if err := txn.UpdateAmount(*input.Amount); err != nil {
				return fmt.Errorf("failed to update amount: %w", err)
			}
		}
		if input.Date != nil {
			if err := txn.UpdateDate(*input.Date); err != nil {
				return fmt.Errorf("failed to update date: %w", err)
			}
		}
		if input.Type != nil {
			if err := txn.UpdateType(*input.Type); err != nil {
				return fmt.Errorf("failed to update type: %w", err)
			}
		}
		if input.Currency != nil {
			if err := txn.UpdateCurrency(*input.Currency); err != nil {
				return fmt.Errorf("failed to update currency: %w", err)
			}
		}
		if input.Notes != nil {
			if err := txn.UpdateNotes(input.Notes); err != nil {
				return fmt.Errorf("failed to update notes: %w", err)
			}
		}
		if input.Files != nil {
			if err := txn.UpdateFiles(input.Files); err != nil {
				return fmt.Errorf("failed to update files: %w", err)
			}
		}
		if input.AccountID != nil {
			if err := txn.UpdateAccount(*input.AccountID); err != nil {
				return fmt.Errorf("failed to update account: %w", err)
			}
		}
		if input.BudgetItemID != nil {
			if err := txn.UpdateBudgetItem(input.BudgetItemID); err != nil {
				return fmt.Errorf("failed to update budget item: %w", err)
			}
		}

		// Reverse old account balance changes
		if err := s.reverseAccountBalance(txCtx, oldAccountID, oldAmount, oldType); err != nil {
			return fmt.Errorf("failed to reverse old balance: %w", err)
		}

		// Apply new account balance changes
		if err := s.updateAccountBalance(txCtx, txn.AccountID(), txn.Amount(), txn.Type()); err != nil {
			return fmt.Errorf("failed to update new balance: %w", err)
		}

		// Save changes
		if err := s.txnRepo.Save(txCtx, txn); err != nil {
			return fmt.Errorf("failed to save transaction: %w", err)
		}

		// Publish domain events
		if s.eventPublisher != nil {
			if err := s.eventPublisher.PublishAggregateEvents(txCtx, txn); err != nil {
				fmt.Printf("Warning: failed to publish events: %v\n", err)
			}
		}

		resultTxn = txn
		return nil
	})

	if err != nil {
		return nil, err
	}

	return resultTxn, nil
}

// DeleteTransaction soft-deletes a transaction and reverses account balance
func (s *Service) DeleteTransaction(ctx context.Context, transactionID uuid.UUID, userID shared.UserID) error {
	return s.txnManager.InTransaction(ctx, func(txCtx context.Context) error {
		// Load the transaction
		txn, err := s.txnRepo.FindByID(txCtx, transactionID)
		if err != nil {
			return fmt.Errorf("failed to find transaction: %w", err)
		}
		if txn == nil {
			return fmt.Errorf("transaction not found")
		}

		// Verify ownership
		if txn.UserID() != userID {
			return fmt.Errorf("access denied")
		}

		// Soft delete
		if err := txn.SoftDelete(); err != nil {
			return fmt.Errorf("failed to delete transaction: %w", err)
		}

		// Reverse account balance
		if err := s.reverseAccountBalance(txCtx, txn.AccountID(), txn.Amount(), txn.Type()); err != nil {
			return fmt.Errorf("failed to reverse balance: %w", err)
		}

		// Save changes
		if err := s.txnRepo.Save(txCtx, txn); err != nil {
			return fmt.Errorf("failed to save transaction: %w", err)
		}

		// Publish domain events
		if s.eventPublisher != nil {
			if err := s.eventPublisher.PublishAggregateEvents(txCtx, txn); err != nil {
				fmt.Printf("Warning: failed to publish events: %v\n", err)
			}
		}

		return nil
	})
}

// GetTransaction retrieves a transaction by ID
func (s *Service) GetTransaction(ctx context.Context, transactionID uuid.UUID, userID shared.UserID) (*transaction.Transaction, error) {
	txn, err := s.txnRepo.FindByID(ctx, transactionID)
	if err != nil {
		return nil, fmt.Errorf("failed to find transaction: %w", err)
	}
	if txn == nil {
		return nil, fmt.Errorf("transaction not found")
	}

	// Verify ownership
	if txn.UserID() != userID {
		return nil, fmt.Errorf("access denied")
	}

	return txn, nil
}

// GetTransactions retrieves transactions for a user with filters
func (s *Service) GetTransactions(ctx context.Context, params transaction.FindManyParams) (*transaction.FindManyResult, error) {
	result, err := s.txnRepo.FindMany(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to find transactions: %w", err)
	}

	return result, nil
}

// updateAccountBalance updates account balance based on transaction type
func (s *Service) updateAccountBalance(ctx context.Context, accountID uuid.UUID, amount float64, txnType transaction.TransactionType) error {
	switch txnType {
	case transaction.TransactionTypeIncome:
		return s.accountSvc.CreditAccount(ctx, accountID, amount)
	case transaction.TransactionTypeExpense:
		return s.accountSvc.DebitAccount(ctx, accountID, amount)
	default:
		return fmt.Errorf("unknown transaction type: %s", txnType)
	}
}

// reverseAccountBalance reverses the effect of a transaction on account balance
func (s *Service) reverseAccountBalance(ctx context.Context, accountID uuid.UUID, amount float64, txnType transaction.TransactionType) error {
	switch txnType {
	case transaction.TransactionTypeIncome:
		// Reverse income: debit the account
		return s.accountSvc.DebitAccount(ctx, accountID, amount)
	case transaction.TransactionTypeExpense:
		// Reverse expense: credit the account
		return s.accountSvc.CreditAccount(ctx, accountID, amount)
	default:
		return fmt.Errorf("unknown transaction type: %s", txnType)
	}
}
