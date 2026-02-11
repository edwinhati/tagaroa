package transaction

import (
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/google/uuid"
)

// TransactionCreatedEvent is published when a new transaction is created
type TransactionCreatedEvent struct {
	TransactionID uuid.UUID
	UserID        shared.UserID
	AccountID     uuid.UUID
	Amount        float64
	Type          TransactionType
	Currency      shared.Currency
	Timestamp     time.Time
}

// TransactionUpdatedEvent is published when a transaction is updated
type TransactionUpdatedEvent struct {
	TransactionID uuid.UUID
	UserID        shared.UserID
	OldAmount     float64
	NewAmount     float64
	Timestamp     time.Time
}

// TransactionDeletedEvent is published when a transaction is deleted
type TransactionDeletedEvent struct {
	TransactionID uuid.UUID
	UserID        shared.UserID
	AccountID     uuid.UUID
	Amount        float64
	Type          TransactionType
	Timestamp     time.Time
}
