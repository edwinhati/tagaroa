package account

import (
	"encoding/json"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/google/uuid"
)

// Account is an aggregate root representing a financial account
type Account struct {
	id              uuid.UUID
	name            string
	actType         AccountType
	balance         float64
	userID          shared.UserID
	currency        shared.Currency
	notes           *string
	deletedAt       *time.Time
	createdAt       time.Time
	updatedAt       time.Time
	version         int // For optimistic concurrency
	originalVersion int // Tracks the version when loaded from DB for optimistic locking

	// Domain events
	events []interface{}
}

// NewAccount creates a new Account aggregate
func NewAccount(
	name string,
	actType AccountType,
	initialBalance float64,
	userID shared.UserID,
	currency shared.Currency,
	notes *string,
) (*Account, error) {
	if name == "" {
		return nil, ErrNameRequired
	}
	if !actType.IsValid() {
		return nil, ErrInvalidType
	}
	if userID.IsZero() {
		return nil, ErrUserIDRequired
	}
	if !currency.IsValid() {
		return nil, ErrInvalidCurrency
	}
	if initialBalance < 0 {
		return nil, ErrInvalidBalance
	}

	now := time.Now()
	account := &Account{
		id:        uuid.New(),
		name:      name,
		actType:   actType,
		balance:   initialBalance,
		userID:    userID,
		currency:  currency,
		notes:     notes,
		createdAt: now,
		updatedAt: now,
		version:   1,
		events:    make([]interface{}, 0),
	}

	account.addEvent(&AccountCreatedEvent{
		AccountID: account.id,
		UserID:    userID,
		Type:      actType,
	})

	return account, nil
}

// RestoreAccount restores an Account from persistence
func RestoreAccount(
	id uuid.UUID,
	name string,
	actType AccountType,
	balance float64,
	userID shared.UserID,
	currency shared.Currency,
	notes *string,
	deletedAt *time.Time,
	createdAt time.Time,
	updatedAt time.Time,
	version int,
) *Account {
	return &Account{
		id:              id,
		name:            name,
		actType:         actType,
		balance:         balance,
		userID:          userID,
		currency:        currency,
		notes:           notes,
		deletedAt:       deletedAt,
		createdAt:       createdAt,
		updatedAt:       updatedAt,
		version:         version,
		originalVersion: version, // Track the version when loaded from DB
		events:          make([]interface{}, 0),
	}
}

// Getters
func (a *Account) ID() uuid.UUID             { return a.id }
func (a *Account) Name() string              { return a.name }
func (a *Account) Type() AccountType         { return a.actType }
func (a *Account) Balance() float64          { return a.balance }
func (a *Account) UserID() shared.UserID     { return a.userID }
func (a *Account) Currency() shared.Currency { return a.currency }
func (a *Account) Notes() *string            { return a.notes }
func (a *Account) DeletedAt() *time.Time     { return a.deletedAt }
func (a *Account) CreatedAt() time.Time      { return a.createdAt }
func (a *Account) UpdatedAt() time.Time      { return a.updatedAt }
func (a *Account) Version() int              { return a.version }

// OriginalVersion returns the version to use for optimistic locking in UPDATE queries.
// For new entities, this returns the current version.
// For restored entities, this returns the version when loaded from the database.
func (a *Account) OriginalVersion() int {
	if a.originalVersion > 0 {
		return a.originalVersion
	}
	return a.version
}

// IsDeleted returns true if the account is soft-deleted
func (a *Account) IsDeleted() bool {
	return a.deletedAt != nil
}

// Credit adds amount to the account balance (for income)
func (a *Account) Credit(amount float64) error {
	if a.IsDeleted() {
		return ErrAccountDeleted
	}
	if amount <= 0 {
		return ErrInvalidAmount
	}
	a.balance += amount
	a.updatedAt = time.Now()
	a.version++

	a.addEvent(&BalanceChangedEvent{
		AccountID:  a.id,
		OldBalance: a.balance - amount,
		NewBalance: a.balance,
		Amount:     amount,
		Operation:  "CREDIT",
	})

	return nil
}

// Debit subtracts amount from the account balance (for expenses)
func (a *Account) Debit(amount float64) error {
	if a.IsDeleted() {
		return ErrAccountDeleted
	}
	if amount <= 0 {
		return ErrInvalidAmount
	}
	if a.balance-amount < 0 {
		return ErrInsufficientBalance
	}
	a.balance -= amount
	a.updatedAt = time.Now()
	a.version++

	a.addEvent(&BalanceChangedEvent{
		AccountID:  a.id,
		OldBalance: a.balance + amount,
		NewBalance: a.balance,
		Amount:     amount,
		Operation:  "DEBIT",
	})

	return nil
}

// UpdateName updates the account name
func (a *Account) UpdateName(name string) error {
	if a.IsDeleted() {
		return ErrAccountDeleted
	}
	if name == "" {
		return ErrNameRequired
	}
	a.name = name
	a.updatedAt = time.Now()
	a.version++
	return nil
}

// UpdateNotes updates the account notes
func (a *Account) UpdateNotes(notes *string) error {
	if a.IsDeleted() {
		return ErrAccountDeleted
	}
	a.notes = notes
	a.updatedAt = time.Now()
	a.version++
	return nil
}

// UpdateBalance updates the account balance
func (a *Account) UpdateBalance(balance float64) error {
	if a.IsDeleted() {
		return ErrAccountDeleted
	}
	if balance < 0 {
		return ErrInvalidBalance
	}
	a.balance = balance
	a.updatedAt = time.Now()
	a.version++

	return nil
}

// SoftDelete marks the account as deleted
func (a *Account) SoftDelete() error {
	if a.IsDeleted() {
		return ErrAccountDeleted
	}
	now := time.Now()
	a.deletedAt = &now
	a.updatedAt = now
	a.version++

	a.addEvent(&AccountDeletedEvent{
		AccountID: a.id,
		UserID:    a.userID,
	})

	return nil
}

// GetEvents returns and clears domain events
func (a *Account) GetEvents() []interface{} {
	events := a.events
	a.events = make([]interface{}, 0)
	return events
}

func (a *Account) addEvent(event interface{}) {
	a.events = append(a.events, event)
}

// Domain errors
var (
	ErrNameRequired        = &shared.DomainError{Code: "NAME_REQUIRED", Message: "account name is required"}
	ErrInvalidType         = &shared.DomainError{Code: "INVALID_TYPE", Message: "invalid account type"}
	ErrUserIDRequired      = &shared.DomainError{Code: "USER_ID_REQUIRED", Message: "user ID is required"}
	ErrInvalidCurrency     = &shared.DomainError{Code: "INVALID_CURRENCY", Message: "invalid currency"}
	ErrInvalidBalance      = &shared.DomainError{Code: "INVALID_BALANCE", Message: "balance cannot be negative"}
	ErrAccountDeleted      = &shared.DomainError{Code: "ACCOUNT_DELETED", Message: "account is deleted"}
	ErrInvalidAmount       = &shared.DomainError{Code: "INVALID_AMOUNT", Message: "amount must be positive"}
	ErrInsufficientBalance = &shared.DomainError{Code: "INSUFFICIENT_BALANCE", Message: "insufficient balance for debit operation"}
)

// accountJSON represents the JSON serialization format for Account
type accountJSON struct {
	ID        uuid.UUID       `json:"id"`
	Name      string          `json:"name"`
	Type      AccountType     `json:"type"`
	Balance   float64         `json:"balance"`
	UserID    uuid.UUID       `json:"user_id"`
	Currency  shared.Currency `json:"currency"`
	Notes     *string         `json:"notes,omitempty"`
	DeletedAt *time.Time      `json:"deleted_at,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	Version   int             `json:"version"`
}

// MarshalJSON implements json.Marshaler interface
func (a *Account) MarshalJSON() ([]byte, error) {
	return json.Marshal(&accountJSON{
		ID:        a.id,
		Name:      a.name,
		Type:      a.actType,
		Balance:   a.balance,
		UserID:    a.userID.UUID(),
		Currency:  a.currency,
		Notes:     a.notes,
		DeletedAt: a.deletedAt,
		CreatedAt: a.createdAt,
		UpdatedAt: a.updatedAt,
		Version:   a.version,
	})
}

// UnmarshalJSON implements json.Unmarshaler interface
func (a *Account) UnmarshalJSON(data []byte) error {
	var aj accountJSON
	if err := json.Unmarshal(data, &aj); err != nil {
		return err
	}
	a.id = aj.ID
	a.name = aj.Name
	a.actType = aj.Type
	a.balance = aj.Balance
	a.userID = shared.UserIDFromUUID(aj.UserID)
	a.currency = aj.Currency
	a.notes = aj.Notes
	a.deletedAt = aj.DeletedAt
	a.createdAt = aj.CreatedAt
	a.updatedAt = aj.UpdatedAt
	a.version = aj.Version
	a.events = make([]interface{}, 0)
	return nil
}
