package investment

import (
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/google/uuid"
)

// LiabilityType represents the type of liability
type LiabilityType string

const (
	LiabilityTypeMortgage     LiabilityType = "MORTGAGE"
	LiabilityTypeCarLoan      LiabilityType = "CAR_LOAN"
	LiabilityTypeStudentLoan  LiabilityType = "STUDENT_LOAN"
	LiabilityTypeCreditCard   LiabilityType = "CREDIT_CARD"
	LiabilityTypePersonalLoan LiabilityType = "PERSONAL_LOAN"
	LiabilityTypeOther        LiabilityType = "OTHER"
)

// AllLiabilityTypes returns all valid liability types
func AllLiabilityTypes() []LiabilityType {
	return []LiabilityType{
		LiabilityTypeMortgage,
		LiabilityTypeCarLoan,
		LiabilityTypeStudentLoan,
		LiabilityTypeCreditCard,
		LiabilityTypePersonalLoan,
		LiabilityTypeOther,
	}
}

// IsValid checks if the liability type is valid
func (t LiabilityType) IsValid() bool {
	switch t {
	case LiabilityTypeMortgage, LiabilityTypeCarLoan, LiabilityTypeStudentLoan,
		LiabilityTypeCreditCard, LiabilityTypePersonalLoan, LiabilityTypeOther:
		return true
	default:
		return false
	}
}

// Liability is an aggregate root representing a financial liability
type Liability struct {
	id              uuid.UUID
	name            string
	liabilityType   LiabilityType
	amount          float64
	remainingAmount float64
	currency        shared.Currency
	userID          shared.UserID
	interestRate    *float64
	dueDate         *time.Time
	notes           *string
	deletedAt       *time.Time
	createdAt       time.Time
	updatedAt       time.Time
	version         int
}

// NewLiability creates a new Liability aggregate
func NewLiability(
	name string,
	liabilityType LiabilityType,
	amount float64,
	currency shared.Currency,
	userID shared.UserID,
	interestRate *float64,
	dueDate *time.Time,
	notes *string,
) (*Liability, error) {
	if name == "" {
		return nil, ErrNameRequired
	}
	if !liabilityType.IsValid() {
		return nil, ErrInvalidType
	}
	if amount <= 0 {
		return nil, ErrInvalidAmount
	}
	if !currency.IsValid() {
		return nil, ErrInvalidCurrency
	}
	if userID.IsZero() {
		return nil, ErrUserIDRequired
	}

	liability := &Liability{
		id:              uuid.New(),
		name:            name,
		liabilityType:   liabilityType,
		amount:          amount,
		remainingAmount: amount, // Initially, remaining equals total
		currency:        currency,
		userID:          userID,
		interestRate:    interestRate,
		dueDate:         dueDate,
		notes:           notes,
		createdAt:       time.Now(),
		updatedAt:       time.Now(),
		version:         1,
	}

	return liability, nil
}

// RestoreLiability restores a Liability from persistence
func RestoreLiability(
	id uuid.UUID,
	name string,
	liabilityType LiabilityType,
	amount float64,
	remainingAmount float64,
	currency shared.Currency,
	userID shared.UserID,
	interestRate *float64,
	dueDate *time.Time,
	notes *string,
	deletedAt *time.Time,
	createdAt time.Time,
	updatedAt time.Time,
	version int,
) *Liability {
	return &Liability{
		id:              id,
		name:            name,
		liabilityType:   liabilityType,
		amount:          amount,
		remainingAmount: remainingAmount,
		currency:        currency,
		userID:          userID,
		interestRate:    interestRate,
		dueDate:         dueDate,
		notes:           notes,
		deletedAt:       deletedAt,
		createdAt:       createdAt,
		updatedAt:       updatedAt,
		version:         version,
	}
}

// Getters
func (l *Liability) ID() uuid.UUID             { return l.id }
func (l *Liability) Name() string              { return l.name }
func (l *Liability) Type() LiabilityType       { return l.liabilityType }
func (l *Liability) Amount() float64           { return l.amount }
func (l *Liability) RemainingAmount() float64  { return l.remainingAmount }
func (l *Liability) Currency() shared.Currency { return l.currency }
func (l *Liability) UserID() shared.UserID     { return l.userID }
func (l *Liability) InterestRate() *float64    { return l.interestRate }
func (l *Liability) DueDate() *time.Time       { return l.dueDate }
func (l *Liability) Notes() *string            { return l.notes }
func (l *Liability) DeletedAt() *time.Time     { return l.deletedAt }
func (l *Liability) CreatedAt() time.Time      { return l.createdAt }
func (l *Liability) UpdatedAt() time.Time      { return l.updatedAt }
func (l *Liability) Version() int              { return l.version }

// IsDeleted returns true if the liability is soft-deleted
func (l *Liability) IsDeleted() bool {
	return l.deletedAt != nil
}

// IsPaidOff returns true if the liability is fully paid
func (l *Liability) IsPaidOff() bool {
	return l.remainingAmount <= 0
}

// MakePayment applies a payment to reduce the remaining amount
func (l *Liability) MakePayment(amount float64) error {
	if l.IsDeleted() {
		return ErrLiabilityDeleted
	}
	if amount <= 0 {
		return ErrInvalidPayment
	}
	l.remainingAmount -= amount
	if l.remainingAmount < 0 {
		l.remainingAmount = 0
	}
	l.updatedAt = time.Now()
	l.version++
	return nil
}

// UpdateAmount updates the total amount of the liability
func (l *Liability) UpdateAmount(amount float64) error {
	if l.IsDeleted() {
		return ErrLiabilityDeleted
	}
	if amount <= 0 {
		return ErrInvalidAmount
	}
	l.amount = amount
	l.updatedAt = time.Now()
	l.version++
	return nil
}

// UpdateName updates the liability name
func (l *Liability) UpdateName(name string) error {
	if l.IsDeleted() {
		return ErrLiabilityDeleted
	}
	if name == "" {
		return ErrNameRequired
	}
	l.name = name
	l.updatedAt = time.Now()
	l.version++
	return nil
}

// UpdateInterestRate updates the interest rate
func (l *Liability) UpdateInterestRate(rate *float64) error {
	if l.IsDeleted() {
		return ErrLiabilityDeleted
	}
	if rate != nil && (*rate < 0 || *rate > 100) {
		return ErrInvalidInterestRate
	}
	l.interestRate = rate
	l.updatedAt = time.Now()
	l.version++
	return nil
}

// UpdateDueDate updates the due date
func (l *Liability) UpdateDueDate(dueDate *time.Time) error {
	if l.IsDeleted() {
		return ErrLiabilityDeleted
	}
	l.dueDate = dueDate
	l.updatedAt = time.Now()
	l.version++
	return nil
}

// UpdateNotes updates the liability notes
func (l *Liability) UpdateNotes(notes *string) error {
	if l.IsDeleted() {
		return ErrLiabilityDeleted
	}
	l.notes = notes
	l.updatedAt = time.Now()
	l.version++
	return nil
}

// SoftDelete marks the liability as deleted
func (l *Liability) SoftDelete() error {
	if l.IsDeleted() {
		return ErrLiabilityDeleted
	}
	now := time.Now()
	l.deletedAt = &now
	l.updatedAt = now
	l.version++
	return nil
}
