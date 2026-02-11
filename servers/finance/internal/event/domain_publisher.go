package event

import (
	"context"
	"fmt"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/account"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/budget"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/transaction"
	"github.com/google/uuid"
)

// DomainEventPublisher publishes domain events
type DomainEventPublisher struct {
	publisher EventPublisher
}

// NewDomainEventPublisher creates a new domain event publisher
func NewDomainEventPublisher(publisher EventPublisher) *DomainEventPublisher {
	return &DomainEventPublisher{
		publisher: publisher,
	}
}

// PublishAggregateEvents publishes all events from an aggregate
func (p *DomainEventPublisher) PublishAggregateEvents(ctx context.Context, aggregate interface{}) error {
	var events []interface{}

	switch v := aggregate.(type) {
	case *account.Account:
		events = v.GetEvents()
	case *transaction.Transaction:
		events = v.GetEvents()
	case *budget.Budget:
		events = v.GetEvents()
	default:
		return fmt.Errorf("unsupported aggregate type: %T", aggregate)
	}

	for _, event := range events {
		if err := p.publishDomainEvent(ctx, event); err != nil {
			return fmt.Errorf("failed to publish event: %w", err)
		}
	}

	return nil
}

// publishDomainEvent publishes a single domain event
func (p *DomainEventPublisher) publishDomainEvent(ctx context.Context, event interface{}) error {
	switch e := event.(type) {
	case *account.AccountCreatedEvent:
		return p.publishAccountCreated(ctx, e)
	case *account.BalanceChangedEvent:
		return p.publishBalanceChanged(ctx, e)
	case *account.AccountDeletedEvent:
		return p.publishAccountDeleted(ctx, e)
	case *account.AccountUpdatedEvent:
		return p.publishAccountUpdated(ctx, e)

	case *transaction.TransactionCreatedEvent:
		return p.publishTransactionCreated(ctx, e)
	case *transaction.TransactionUpdatedEvent:
		return p.publishTransactionUpdated(ctx, e)
	case *transaction.TransactionDeletedEvent:
		return p.publishTransactionDeleted(ctx, e)

	case *budget.BudgetCreatedEvent:
		return p.publishBudgetCreated(ctx, e)
	case *budget.BudgetUpdatedEvent:
		return p.publishBudgetUpdated(ctx, e)
	case *budget.BudgetDeletedEvent:
		return p.publishBudgetDeleted(ctx, e)
	case *budget.BudgetItemAddedEvent:
		return p.publishBudgetItemAdded(ctx, e)
	case *budget.BudgetItemUpdatedEvent:
		return p.publishBudgetItemUpdated(ctx, e)

	default:
		return fmt.Errorf("unknown event type: %T", event)
	}
}

func (p *DomainEventPublisher) publishAccountCreated(ctx context.Context, e *account.AccountCreatedEvent) error {
	domainEvent := NewEvent(EventAccountBalanceUpdated, e.UserID.String()).
		WithPayload("account_id", e.AccountID.String()).
		WithPayload("account_type", string(e.Type)).
		WithPayload("name", e.Name).
		WithPayload("currency", string(e.Currency)).
		WithPayload("initial_balance", 0.0).
		WithPayload("operation", "ACCOUNT_CREATED").
		Build()

	return p.publisher.Publish(ctx, domainEvent)
}

func (p *DomainEventPublisher) publishBalanceChanged(ctx context.Context, e *account.BalanceChangedEvent) error {
	domainEvent := NewEvent(EventAccountBalanceUpdated, e.UserID.String()).
		WithPayload("account_id", e.AccountID.String()).
		WithPayload("old_balance", e.OldBalance).
		WithPayload("new_balance", e.NewBalance).
		WithPayload("amount", e.Amount).
		WithPayload("operation", e.Operation).
		Build()

	return p.publisher.Publish(ctx, domainEvent)
}

func (p *DomainEventPublisher) publishAccountDeleted(ctx context.Context, e *account.AccountDeletedEvent) error {
	domainEvent := NewEvent(EventAccountBalanceUpdated, e.UserID.String()).
		WithPayload("account_id", e.AccountID.String()).
		WithPayload("operation", "ACCOUNT_DELETED").
		Build()

	return p.publisher.Publish(ctx, domainEvent)
}

func (p *DomainEventPublisher) publishAccountUpdated(ctx context.Context, e *account.AccountUpdatedEvent) error {
	domainEvent := NewEvent(EventAccountBalanceUpdated, e.UserID.String()).
		WithPayload("account_id", e.AccountID.String()).
		WithPayload("operation", "ACCOUNT_UPDATED").
		Build()

	return p.publisher.Publish(ctx, domainEvent)
}

func (p *DomainEventPublisher) publishTransactionCreated(ctx context.Context, e *transaction.TransactionCreatedEvent) error {
	domainEvent := NewEvent(EventTransactionCreated, e.UserID.String()).
		WithPayload("transaction_id", e.TransactionID.String()).
		WithPayload("account_id", e.AccountID.String()).
		WithPayload("amount", e.Amount).
		WithPayload("type", string(e.Type)).
		WithPayload("currency", string(e.Currency)).
		Build()

	return p.publisher.Publish(ctx, domainEvent)
}

func (p *DomainEventPublisher) publishTransactionUpdated(ctx context.Context, e *transaction.TransactionUpdatedEvent) error {
	domainEvent := NewEvent(EventTransactionUpdated, e.UserID.String()).
		WithPayload("transaction_id", e.TransactionID.String()).
		WithPayload("old_amount", e.OldAmount).
		WithPayload("new_amount", e.NewAmount).
		Build()

	return p.publisher.Publish(ctx, domainEvent)
}

func (p *DomainEventPublisher) publishTransactionDeleted(ctx context.Context, e *transaction.TransactionDeletedEvent) error {
	domainEvent := NewEvent(EventTransactionDeleted, "").
		WithPayload("transaction_id", e.TransactionID.String()).
		WithPayload("account_id", e.AccountID.String()).
		WithPayload("amount", e.Amount).
		WithPayload("type", string(e.Type)).
		Build()

	return p.publisher.Publish(ctx, domainEvent)
}

func (p *DomainEventPublisher) publishBudgetCreated(ctx context.Context, e *budget.BudgetCreatedEvent) error {
	domainEvent := NewEvent(EventBudgetCreated, e.UserID.String()).
		WithPayload("budget_id", e.BudgetID.String()).
		WithPayload("month", e.Month).
		WithPayload("year", e.Year).
		WithPayload("amount", e.Amount).
		WithPayload("currency", string(e.Currency)).
		Build()

	return p.publisher.Publish(ctx, domainEvent)
}

func (p *DomainEventPublisher) publishBudgetUpdated(ctx context.Context, e *budget.BudgetUpdatedEvent) error {
	domainEvent := NewEvent(EventBudgetUpdated, e.UserID.String()).
		WithPayload("budget_id", e.BudgetID.String()).
		Build()

	return p.publisher.Publish(ctx, domainEvent)
}

func (p *DomainEventPublisher) publishBudgetDeleted(ctx context.Context, e *budget.BudgetDeletedEvent) error {
	domainEvent := NewEvent(EventBudgetUpdated, e.UserID.String()).
		WithPayload("budget_id", e.BudgetID.String()).
		WithPayload("operation", "DELETED").
		Build()

	return p.publisher.Publish(ctx, domainEvent)
}

func (p *DomainEventPublisher) publishBudgetItemAdded(ctx context.Context, e *budget.BudgetItemAddedEvent) error {
	domainEvent := NewEvent(EventBudgetUpdated, "").
		WithPayload("budget_id", e.BudgetID.String()).
		WithPayload("item_id", e.ItemID.String()).
		WithPayload("category", e.Category).
		WithPayload("allocation", e.Allocation).
		WithPayload("operation", "ITEM_ADDED").
		Build()

	return p.publisher.Publish(ctx, domainEvent)
}

func (p *DomainEventPublisher) publishBudgetItemUpdated(ctx context.Context, e *budget.BudgetItemUpdatedEvent) error {
	domainEvent := NewEvent(EventBudgetUpdated, "").
		WithPayload("budget_id", e.BudgetID.String()).
		WithPayload("item_id", e.ItemID.String()).
		WithPayload("operation", "ITEM_UPDATED").
		Build()

	return p.publisher.Publish(ctx, domainEvent)
}

// GetUserIDFromEvent extracts userID from various event types
func GetUserIDFromEvent(event interface{}) uuid.UUID {
	switch e := event.(type) {
	case *account.AccountCreatedEvent:
		return e.UserID.UUID()
	case *account.BalanceChangedEvent:
		return e.UserID.UUID()
	case *account.AccountDeletedEvent:
		return e.UserID.UUID()
	case *account.AccountUpdatedEvent:
		return e.UserID.UUID()
	case *transaction.TransactionCreatedEvent:
		return e.UserID.UUID()
	case *transaction.TransactionUpdatedEvent:
		return e.UserID.UUID()
	case *transaction.TransactionDeletedEvent:
		return e.UserID.UUID()
	case *budget.BudgetCreatedEvent:
		return e.UserID.UUID()
	case *budget.BudgetUpdatedEvent:
		return e.UserID.UUID()
	case *budget.BudgetDeletedEvent:
		return e.UserID.UUID()
	}
	return uuid.Nil
}
