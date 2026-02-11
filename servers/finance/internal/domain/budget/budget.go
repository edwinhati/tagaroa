package budget

import (
	"encoding/json"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/google/uuid"
)

// Budget is an aggregate root representing a budget for a specific month/year
type Budget struct {
	id          uuid.UUID
	month       int
	year        int
	amount      float64
	userID      shared.UserID
	currency    shared.Currency
	deletedAt   *time.Time
	createdAt   time.Time
	updatedAt   time.Time
	version     int
	budgetItems []*BudgetItem
	events      []interface{}
}

// BudgetItem is an entity within the Budget aggregate
type BudgetItem struct {
	id         uuid.UUID
	allocation float64
	category   string
	spent      float64
	deletedAt  *time.Time
	createdAt  time.Time
	updatedAt  time.Time
}

// NewBudget creates a new Budget aggregate
func NewBudget(
	month int,
	year int,
	amount float64,
	userID shared.UserID,
	currency shared.Currency,
) (*Budget, error) {
	if month < 1 || month > 12 {
		return nil, ErrInvalidMonth
	}
	if year < 2000 || year > 2100 {
		return nil, ErrInvalidYear
	}
	if amount <= 0 {
		return nil, ErrInvalidAmount
	}
	if userID.IsZero() {
		return nil, ErrUserIDRequired
	}
	if !currency.IsValid() {
		return nil, ErrInvalidCurrency
	}

	now := time.Now()
	budget := &Budget{
		id:          uuid.New(),
		month:       month,
		year:        year,
		amount:      amount,
		userID:      userID,
		currency:    currency,
		createdAt:   now,
		updatedAt:   now,
		version:     1,
		budgetItems: make([]*BudgetItem, 0),
		events:      make([]interface{}, 0),
	}

	budget.addEvent(&BudgetCreatedEvent{
		BudgetID: budget.id,
		UserID:   userID,
		Month:    month,
		Year:     year,
		Amount:   amount,
	})

	return budget, nil
}

// RestoreBudget restores a Budget from persistence
func RestoreBudget(
	id uuid.UUID,
	month int,
	year int,
	amount float64,
	userID shared.UserID,
	currency shared.Currency,
	deletedAt *time.Time,
	createdAt time.Time,
	updatedAt time.Time,
	version int,
	budgetItems []*BudgetItem,
) *Budget {
	return &Budget{
		id:          id,
		month:       month,
		year:        year,
		amount:      amount,
		userID:      userID,
		currency:    currency,
		deletedAt:   deletedAt,
		createdAt:   createdAt,
		updatedAt:   updatedAt,
		version:     version,
		budgetItems: budgetItems,
		events:      make([]interface{}, 0),
	}
}

// RestoreBudgetItem restores a BudgetItem from persistence
func RestoreBudgetItem(
	id uuid.UUID,
	allocation float64,
	category string,
	spent float64,
	deletedAt *time.Time,
	createdAt time.Time,
	updatedAt time.Time,
) *BudgetItem {
	return &BudgetItem{
		id:         id,
		allocation: allocation,
		category:   category,
		spent:      spent,
		deletedAt:  deletedAt,
		createdAt:  createdAt,
		updatedAt:  updatedAt,
	}
}

// Getters
func (b *Budget) ID() uuid.UUID             { return b.id }
func (b *Budget) Month() int                { return b.month }
func (b *Budget) Year() int                 { return b.year }
func (b *Budget) Amount() float64           { return b.amount }
func (b *Budget) UserID() shared.UserID     { return b.userID }
func (b *Budget) Currency() shared.Currency { return b.currency }
func (b *Budget) DeletedAt() *time.Time     { return b.deletedAt }
func (b *Budget) CreatedAt() time.Time      { return b.createdAt }
func (b *Budget) UpdatedAt() time.Time      { return b.updatedAt }
func (b *Budget) Version() int              { return b.version }
func (b *Budget) Items() []*BudgetItem      { return b.budgetItems }

// IsDeleted returns true if the budget is soft-deleted
func (b *Budget) IsDeleted() bool {
	return b.deletedAt != nil
}

// AddItem adds a new budget item to the budget
func (b *Budget) AddItem(category string, allocation float64) error {
	if b.IsDeleted() {
		return ErrBudgetDeleted
	}
	if category == "" {
		return ErrCategoryRequired
	}
	if allocation <= 0 {
		return ErrInvalidAllocation
	}

	item := &BudgetItem{
		id:         uuid.New(),
		category:   category,
		allocation: allocation,
		spent:      0,
		createdAt:  time.Now(),
		updatedAt:  time.Now(),
	}

	b.budgetItems = append(b.budgetItems, item)
	b.updatedAt = time.Now()
	b.version++

	return nil
}

// RemoveItem removes a budget item by ID
func (b *Budget) RemoveItem(itemID uuid.UUID) error {
	if b.IsDeleted() {
		return ErrBudgetDeleted
	}

	for _, item := range b.budgetItems {
		if item.ID() == itemID {
			// Soft delete the item
			now := time.Now()
			item.deletedAt = &now
			item.updatedAt = now
			b.updatedAt = now
			b.version++
			return nil
		}
	}

	return ErrItemNotFound
}

// UpdateAllocation updates a budget item's allocation
func (b *Budget) UpdateAllocation(itemID uuid.UUID, allocation float64) error {
	if b.IsDeleted() {
		return ErrBudgetDeleted
	}
	if allocation <= 0 {
		return ErrInvalidAllocation
	}

	for _, item := range b.budgetItems {
		if item.ID() == itemID && item.deletedAt == nil {
			item.allocation = allocation
			item.updatedAt = time.Now()
			b.updatedAt = time.Now()
			b.version++
			return nil
		}
	}

	return ErrItemNotFound
}

// UpdateSpending updates the spent amount for a budget item
func (b *Budget) UpdateSpending(itemID uuid.UUID, spent float64) error {
	if b.IsDeleted() {
		return ErrBudgetDeleted
	}
	if spent < 0 {
		return ErrInvalidSpentAmount
	}

	for _, item := range b.budgetItems {
		if item.ID() == itemID && item.deletedAt == nil {
			item.spent = spent
			item.updatedAt = time.Now()
			b.updatedAt = time.Now()
			b.version++
			return nil
		}
	}

	return ErrItemNotFound
}

// UpdateAmount updates the total budget amount
func (b *Budget) UpdateAmount(amount float64) error {
	if b.IsDeleted() {
		return ErrBudgetDeleted
	}
	if amount <= 0 {
		return ErrInvalidAmount
	}
	b.amount = amount
	b.updatedAt = time.Now()
	b.version++
	return nil
}

// SoftDelete marks the budget as deleted
func (b *Budget) SoftDelete() error {
	if b.IsDeleted() {
		return ErrBudgetDeleted
	}
	now := time.Now()
	b.deletedAt = &now
	b.updatedAt = now
	b.version++

	b.addEvent(&BudgetDeletedEvent{
		BudgetID: b.id,
		UserID:   b.userID,
	})

	return nil
}

// GetTotalAllocation returns the sum of all item allocations
func (b *Budget) GetTotalAllocation() float64 {
	total := 0.0
	for _, item := range b.budgetItems {
		if item.deletedAt == nil {
			total += item.allocation
		}
	}
	return total
}

// GetTotalSpent returns the sum of all item spending
func (b *Budget) GetTotalSpent() float64 {
	total := 0.0
	for _, item := range b.budgetItems {
		if item.deletedAt == nil {
			total += item.spent
		}
	}
	return total
}

// GetRemaining returns the remaining budget amount
func (b *Budget) GetRemaining() float64 {
	return b.amount - b.GetTotalSpent()
}

// GetEvents returns and clears domain events
func (b *Budget) GetEvents() []interface{} {
	events := b.events
	b.events = make([]interface{}, 0)
	return events
}

func (b *Budget) addEvent(event interface{}) {
	b.events = append(b.events, event)
}

// BudgetItem getters
func (i *BudgetItem) ID() uuid.UUID         { return i.id }
func (i *BudgetItem) Allocation() float64   { return i.allocation }
func (i *BudgetItem) Category() string      { return i.category }
func (i *BudgetItem) Spent() float64        { return i.spent }
func (i *BudgetItem) DeletedAt() *time.Time { return i.deletedAt }
func (i *BudgetItem) CreatedAt() time.Time  { return i.createdAt }
func (i *BudgetItem) UpdatedAt() time.Time  { return i.updatedAt }

// Domain errors
var (
	ErrInvalidMonth       = &shared.DomainError{Code: "INVALID_MONTH", Message: "month must be between 1 and 12"}
	ErrInvalidYear        = &shared.DomainError{Code: "INVALID_YEAR", Message: "year must be between 2000 and 2100"}
	ErrInvalidAmount      = &shared.DomainError{Code: "INVALID_AMOUNT", Message: "amount must be positive"}
	ErrUserIDRequired     = &shared.DomainError{Code: "USER_ID_REQUIRED", Message: "user ID is required"}
	ErrInvalidCurrency    = &shared.DomainError{Code: "INVALID_CURRENCY", Message: "invalid currency"}
	ErrBudgetDeleted      = &shared.DomainError{Code: "BUDGET_DELETED", Message: "budget is deleted"}
	ErrCategoryRequired   = &shared.DomainError{Code: "CATEGORY_REQUIRED", Message: "category is required"}
	ErrInvalidAllocation  = &shared.DomainError{Code: "INVALID_ALLOCATION", Message: "allocation must be positive"}
	ErrItemNotFound       = &shared.DomainError{Code: "ITEM_NOT_FOUND", Message: "budget item not found"}
	ErrInvalidSpentAmount = &shared.DomainError{Code: "INVALID_SPENT", Message: "spent amount cannot be negative"}
)

// budgetItemJSON represents the JSON serialization format for BudgetItem
type budgetItemJSON struct {
	ID         uuid.UUID  `json:"id"`
	Allocation float64    `json:"allocation"`
	Category   string     `json:"category"`
	Spent      float64    `json:"spent"`
	DeletedAt  *time.Time `json:"deleted_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// MarshalJSON implements json.Marshaler interface for BudgetItem
func (i *BudgetItem) MarshalJSON() ([]byte, error) {
	return json.Marshal(&budgetItemJSON{
		ID:         i.id,
		Allocation: i.allocation,
		Category:   i.category,
		Spent:      i.spent,
		DeletedAt:  i.deletedAt,
		CreatedAt:  i.createdAt,
		UpdatedAt:  i.updatedAt,
	})
}

// UnmarshalJSON implements json.Unmarshaler interface for BudgetItem
func (i *BudgetItem) UnmarshalJSON(data []byte) error {
	var ij budgetItemJSON
	if err := json.Unmarshal(data, &ij); err != nil {
		return err
	}
	i.id = ij.ID
	i.allocation = ij.Allocation
	i.category = ij.Category
	i.spent = ij.Spent
	i.deletedAt = ij.DeletedAt
	i.createdAt = ij.CreatedAt
	i.updatedAt = ij.UpdatedAt
	return nil
}

// budgetJSON represents the JSON serialization format for Budget
type budgetJSON struct {
	ID        uuid.UUID       `json:"id"`
	Month     int             `json:"month"`
	Year      int             `json:"year"`
	Amount    float64         `json:"amount"`
	UserID    uuid.UUID       `json:"user_id"`
	Currency  shared.Currency `json:"currency"`
	DeletedAt *time.Time      `json:"deleted_at,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	Version   int             `json:"version"`
	Items     []*BudgetItem   `json:"items"`
}

// MarshalJSON implements json.Marshaler interface for Budget
func (b *Budget) MarshalJSON() ([]byte, error) {
	return json.Marshal(&budgetJSON{
		ID:        b.id,
		Month:     b.month,
		Year:      b.year,
		Amount:    b.amount,
		UserID:    b.userID.UUID(),
		Currency:  b.currency,
		DeletedAt: b.deletedAt,
		CreatedAt: b.createdAt,
		UpdatedAt: b.updatedAt,
		Version:   b.version,
		Items:     b.budgetItems,
	})
}

// UnmarshalJSON implements json.Unmarshaler interface for Budget
func (b *Budget) UnmarshalJSON(data []byte) error {
	var bj budgetJSON
	if err := json.Unmarshal(data, &bj); err != nil {
		return err
	}
	b.id = bj.ID
	b.month = bj.Month
	b.year = bj.Year
	b.amount = bj.Amount
	b.userID = shared.UserIDFromUUID(bj.UserID)
	b.currency = bj.Currency
	b.deletedAt = bj.DeletedAt
	b.createdAt = bj.CreatedAt
	b.updatedAt = bj.UpdatedAt
	b.version = bj.Version
	b.budgetItems = bj.Items
	b.events = make([]interface{}, 0)
	return nil
}
