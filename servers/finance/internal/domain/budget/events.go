package budget

import (
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/google/uuid"
)

// BudgetCreatedEvent is published when a new budget is created
type BudgetCreatedEvent struct {
	BudgetID  uuid.UUID
	UserID    shared.UserID
	Month     int
	Year      int
	Amount    float64
	Currency  shared.Currency
	Timestamp time.Time
}

// BudgetUpdatedEvent is published when a budget is updated
type BudgetUpdatedEvent struct {
	BudgetID  uuid.UUID
	UserID    shared.UserID
	Timestamp time.Time
}

// BudgetDeletedEvent is published when a budget is deleted
type BudgetDeletedEvent struct {
	BudgetID  uuid.UUID
	UserID    shared.UserID
	Timestamp time.Time
}

// BudgetItemAddedEvent is published when a budget item is added
type BudgetItemAddedEvent struct {
	BudgetID   uuid.UUID
	ItemID     uuid.UUID
	Category   string
	Allocation float64
	Timestamp  time.Time
}

// BudgetItemUpdatedEvent is published when a budget item is updated
type BudgetItemUpdatedEvent struct {
	BudgetID  uuid.UUID
	ItemID    uuid.UUID
	Timestamp time.Time
}
