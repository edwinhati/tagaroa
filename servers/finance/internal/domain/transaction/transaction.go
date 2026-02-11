package transaction

import (
	"encoding/json"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/google/uuid"
)

// Transaction is an aggregate root representing a financial transaction
type Transaction struct {
	id           uuid.UUID
	amount       float64
	date         time.Time
	txnType      TransactionType
	currency     shared.Currency
	notes        *string
	files        []string
	userID       shared.UserID
	accountID    uuid.UUID
	budgetItemID *uuid.UUID
	deletedAt    *time.Time
	createdAt    time.Time
	updatedAt    time.Time
	version      int

	// Snapshots for display
	accountSnapshot    *AccountSnapshot
	budgetItemSnapshot *BudgetItemSnapshot

	// Domain events
	events []interface{}
}

// AccountSnapshot represents a snapshot of account data
type AccountSnapshot struct {
	ID       uuid.UUID       `json:"id"`
	Name     string          `json:"name"`
	Type     string          `json:"type"`
	Balance  float64         `json:"balance"`
	Currency shared.Currency `json:"currency"`
}

// BudgetItemSnapshot represents a snapshot of budget item data
type BudgetItemSnapshot struct {
	ID         uuid.UUID `json:"id"`
	Allocation float64   `json:"allocation"`
	Category   string    `json:"category"`
}

// NewTransaction creates a new Transaction aggregate
func NewTransaction(
	amount float64,
	date time.Time,
	txnType TransactionType,
	currency shared.Currency,
	notes *string,
	files []string,
	userID shared.UserID,
	accountID uuid.UUID,
	budgetItemID *uuid.UUID,
) (*Transaction, error) {
	if amount <= 0 {
		return nil, ErrInvalidAmount
	}
	if !txnType.IsValid() {
		return nil, ErrInvalidType
	}
	if !currency.IsValid() {
		return nil, ErrInvalidCurrency
	}
	if userID.IsZero() {
		return nil, ErrUserIDRequired
	}
	if accountID == uuid.Nil {
		return nil, ErrAccountIDRequired
	}
	if date.IsZero() {
		date = time.Now()
	}

	now := time.Now()
	txn := &Transaction{
		id:           uuid.New(),
		amount:       amount,
		date:         date,
		txnType:      txnType,
		currency:     currency,
		notes:        notes,
		files:        files,
		userID:       userID,
		accountID:    accountID,
		budgetItemID: budgetItemID,
		createdAt:    now,
		updatedAt:    now,
		version:      1,
		events:       make([]interface{}, 0),
	}

	txn.addEvent(&TransactionCreatedEvent{
		TransactionID: txn.id,
		UserID:        userID,
		AccountID:     accountID,
		Amount:        amount,
		Type:          txnType,
	})

	return txn, nil
}

// RestoreTransaction restores a Transaction from persistence
func RestoreTransaction(
	id uuid.UUID,
	amount float64,
	date time.Time,
	txnType TransactionType,
	currency shared.Currency,
	notes *string,
	files []string,
	userID shared.UserID,
	accountID uuid.UUID,
	budgetItemID *uuid.UUID,
	deletedAt *time.Time,
	createdAt time.Time,
	updatedAt time.Time,
	version int,
	accountSnapshot *AccountSnapshot,
	budgetItemSnapshot *BudgetItemSnapshot,
) *Transaction {
	return &Transaction{
		id:                 id,
		amount:             amount,
		date:               date,
		txnType:            txnType,
		currency:           currency,
		notes:              notes,
		files:              files,
		userID:             userID,
		accountID:          accountID,
		budgetItemID:       budgetItemID,
		deletedAt:          deletedAt,
		createdAt:          createdAt,
		updatedAt:          updatedAt,
		version:            version,
		accountSnapshot:    accountSnapshot,
		budgetItemSnapshot: budgetItemSnapshot,
		events:             make([]interface{}, 0),
	}
}

// Getters
func (t *Transaction) ID() uuid.UUID             { return t.id }
func (t *Transaction) Amount() float64           { return t.amount }
func (t *Transaction) Date() time.Time           { return t.date }
func (t *Transaction) Type() TransactionType     { return t.txnType }
func (t *Transaction) Currency() shared.Currency { return t.currency }
func (t *Transaction) Notes() *string            { return t.notes }
func (t *Transaction) Files() []string           { return t.files }
func (t *Transaction) UserID() shared.UserID     { return t.userID }
func (t *Transaction) AccountID() uuid.UUID      { return t.accountID }
func (t *Transaction) BudgetItemID() *uuid.UUID  { return t.budgetItemID }
func (t *Transaction) DeletedAt() *time.Time     { return t.deletedAt }
func (t *Transaction) CreatedAt() time.Time      { return t.createdAt }
func (t *Transaction) UpdatedAt() time.Time      { return t.updatedAt }
func (t *Transaction) Version() int              { return t.version }

// IsDeleted returns true if the transaction is soft-deleted
func (t *Transaction) IsDeleted() bool {
	return t.deletedAt != nil
}

// UpdateAmount updates the transaction amount
func (t *Transaction) UpdateAmount(amount float64) error {
	if t.IsDeleted() {
		return ErrTransactionDeleted
	}
	if amount <= 0 {
		return ErrInvalidAmount
	}
	oldAmount := t.amount
	t.amount = amount
	t.updatedAt = time.Now()
	t.version++

	t.addEvent(&TransactionUpdatedEvent{
		TransactionID: t.id,
		OldAmount:     oldAmount,
		NewAmount:     amount,
	})

	return nil
}

// UpdateDate updates the transaction date
func (t *Transaction) UpdateDate(date time.Time) error {
	if t.IsDeleted() {
		return ErrTransactionDeleted
	}
	if date.IsZero() {
		return ErrInvalidDate
	}
	t.date = date
	t.updatedAt = time.Now()
	t.version++
	return nil
}

// UpdateType updates the transaction type
func (t *Transaction) UpdateType(txnType TransactionType) error {
	if t.IsDeleted() {
		return ErrTransactionDeleted
	}
	if !txnType.IsValid() {
		return ErrInvalidType
	}
	t.txnType = txnType
	t.updatedAt = time.Now()
	t.version++
	return nil
}

// UpdateCurrency updates the transaction currency
func (t *Transaction) UpdateCurrency(currency shared.Currency) error {
	if t.IsDeleted() {
		return ErrTransactionDeleted
	}
	if !currency.IsValid() {
		return ErrInvalidCurrency
	}
	t.currency = currency
	t.updatedAt = time.Now()
	t.version++
	return nil
}

// UpdateNotes updates the transaction notes
func (t *Transaction) UpdateNotes(notes *string) error {
	if t.IsDeleted() {
		return ErrTransactionDeleted
	}
	t.notes = notes
	t.updatedAt = time.Now()
	t.version++
	return nil
}

// UpdateFiles updates the transaction files
func (t *Transaction) UpdateFiles(files []string) error {
	if t.IsDeleted() {
		return ErrTransactionDeleted
	}
	t.files = files
	t.updatedAt = time.Now()
	t.version++
	return nil
}

// UpdateAccount updates the associated account
func (t *Transaction) UpdateAccount(accountID uuid.UUID) error {
	if t.IsDeleted() {
		return ErrTransactionDeleted
	}
	if accountID == uuid.Nil {
		return ErrAccountIDRequired
	}
	t.accountID = accountID
	t.updatedAt = time.Now()
	t.version++
	return nil
}

// UpdateBudgetItem updates the associated budget item
func (t *Transaction) UpdateBudgetItem(budgetItemID *uuid.UUID) error {
	if t.IsDeleted() {
		return ErrTransactionDeleted
	}
	t.budgetItemID = budgetItemID
	t.updatedAt = time.Now()
	t.version++
	return nil
}

// SoftDelete marks the transaction as deleted
func (t *Transaction) SoftDelete() error {
	if t.IsDeleted() {
		return ErrTransactionDeleted
	}
	now := time.Now()
	t.deletedAt = &now
	t.updatedAt = now
	t.version++

	t.addEvent(&TransactionDeletedEvent{
		TransactionID: t.id,
		AccountID:     t.accountID,
		Amount:        t.amount,
		Type:          t.txnType,
	})

	return nil
}

// GetEvents returns and clears domain events
func (t *Transaction) GetEvents() []interface{} {
	events := t.events
	t.events = make([]interface{}, 0)
	return events
}

func (t *Transaction) addEvent(event interface{}) {
	t.events = append(t.events, event)
}

// Domain errors
var (
	ErrInvalidAmount      = &shared.DomainError{Code: "INVALID_AMOUNT", Message: "amount must be positive"}
	ErrInvalidType        = &shared.DomainError{Code: "INVALID_TYPE", Message: "invalid transaction type"}
	ErrInvalidCurrency    = &shared.DomainError{Code: "INVALID_CURRENCY", Message: "invalid currency"}
	ErrUserIDRequired     = &shared.DomainError{Code: "USER_ID_REQUIRED", Message: "user ID is required"}
	ErrAccountIDRequired  = &shared.DomainError{Code: "ACCOUNT_ID_REQUIRED", Message: "account ID is required"}
	ErrTransactionDeleted = &shared.DomainError{Code: "TRANSACTION_DELETED", Message: "transaction is deleted"}
	ErrInvalidDate        = &shared.DomainError{Code: "INVALID_DATE", Message: "date cannot be zero"}
)

// transactionJSON represents the JSON serialization format for Transaction
type transactionJSON struct {
	ID           uuid.UUID       `json:"id"`
	Amount       float64         `json:"amount"`
	Date         time.Time       `json:"date"`
	Type         TransactionType `json:"type"`
	Currency     shared.Currency `json:"currency"`
	Notes        *string         `json:"notes,omitempty"`
	Files        []string        `json:"files,omitempty"`
	UserID       uuid.UUID       `json:"user_id"`
	AccountID    uuid.UUID           `json:"account_id"`
	BudgetItemID *uuid.UUID          `json:"budget_item_id,omitempty"`
	DeletedAt    *time.Time          `json:"deleted_at,omitempty"`
	CreatedAt    time.Time           `json:"created_at"`
	UpdatedAt    time.Time           `json:"updated_at"`
	Version      int                 `json:"version"`
	Account      *AccountSnapshot    `json:"account,omitempty"`
	BudgetItem   *BudgetItemSnapshot `json:"budget_item,omitempty"`
}

// MarshalJSON implements json.Marshaler interface
func (t *Transaction) MarshalJSON() ([]byte, error) {
	return json.Marshal(&transactionJSON{
		ID:           t.id,
		Amount:       t.amount,
		Date:         t.date,
		Type:         t.txnType,
		Currency:     t.currency,
		Notes:        t.notes,
		Files:        t.files,
		UserID:       t.userID.UUID(),
		AccountID:    t.accountID,
		BudgetItemID: t.budgetItemID,
		DeletedAt:    t.deletedAt,
		CreatedAt:    t.createdAt,
		UpdatedAt:    t.updatedAt,
		Version:      t.version,
		Account:      t.accountSnapshot,
		BudgetItem:   t.budgetItemSnapshot,
	})
}

// UnmarshalJSON implements json.Unmarshaler interface
func (t *Transaction) UnmarshalJSON(data []byte) error {
	var tj transactionJSON
	if err := json.Unmarshal(data, &tj); err != nil {
		return err
	}
	t.id = tj.ID
	t.amount = tj.Amount
	t.date = tj.Date
	t.txnType = tj.Type
	t.currency = tj.Currency
	t.notes = tj.Notes
	t.files = tj.Files
	t.userID = shared.UserIDFromUUID(tj.UserID)
	t.accountID = tj.AccountID
	t.budgetItemID = tj.BudgetItemID
	t.deletedAt = tj.DeletedAt
	t.createdAt = tj.CreatedAt
	t.updatedAt = tj.UpdatedAt
	t.version = tj.Version
	t.accountSnapshot = tj.Account
	t.budgetItemSnapshot = tj.BudgetItem
	t.events = make([]interface{}, 0)
	return nil
}
