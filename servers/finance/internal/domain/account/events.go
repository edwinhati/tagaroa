package account

import (
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/google/uuid"
)

// AccountCreatedEvent is published when a new account is created
type AccountCreatedEvent struct {
	AccountID uuid.UUID
	UserID    shared.UserID
	Type      AccountType
	Name      string
	Currency  shared.Currency
	Timestamp time.Time
}

// BalanceChangedEvent is published when an account balance changes
type BalanceChangedEvent struct {
	AccountID  uuid.UUID
	UserID     shared.UserID
	OldBalance float64
	NewBalance float64
	Amount     float64
	Operation  string // "CREDIT" or "DEBIT"
	Timestamp  time.Time
}

// AccountDeletedEvent is published when an account is soft-deleted
type AccountDeletedEvent struct {
	AccountID uuid.UUID
	UserID    shared.UserID
	Timestamp time.Time
}

// AccountUpdatedEvent is published when account details are updated
type AccountUpdatedEvent struct {
	AccountID uuid.UUID
	UserID    shared.UserID
	Timestamp time.Time
}
