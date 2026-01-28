package model

import (
	"time"

	"github.com/google/uuid"
)

type LiabilityType string

type Liability struct {
	ID        uuid.UUID     `json:"id"`
	Name      string        `json:"name"`
	Type      LiabilityType `json:"type"`
	Amount    float64       `json:"amount"`
	Currency  string        `json:"currency"`
	UserID    uuid.UUID     `json:"user_id"`
	PaidAt    *time.Time    `json:"paid_at,omitempty"`
	Notes     *string       `json:"notes,omitempty"`
	DeletedAt *time.Time    `json:"deleted_at,omitempty"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

const (
	LiabilityTypeMortgage   LiabilityType = "MORTGAGE"
	LiabilityTypeLoan       LiabilityType = "LOAN"
	LiabilityTypeCreditCard LiabilityType = "CREDIT-CARD"
	LiabilityTypeOther      LiabilityType = "OTHER"
)

func LiabilityTypes() []LiabilityType {
	return []LiabilityType{
		LiabilityTypeMortgage,
		LiabilityTypeLoan,
		LiabilityTypeCreditCard,
		LiabilityTypeOther,
	}
}
