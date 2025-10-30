package model

import (
	"time"

	"github.com/google/uuid"
)

type AccountType string

type Account struct {
	ID        uuid.UUID   `json:"id"`
	Name      string      `json:"name"`
	Type      AccountType `json:"type"`
	Balance   float64     `json:"balance"`
	UserID    uuid.UUID   `json:"user_id"`
	Currency  string      `json:"currency"`
	Notes     *string     `json:"notes,omitempty"`
	IsDeleted bool        `json:"is_deleted"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

const (
	AccountTypeBank       AccountType = "BANK"
	AccountTypeEWallet    AccountType = "E-WALLET"
	AccountTypeCash       AccountType = "CASH"
	AccountTypeCreditCard AccountType = "CREDIT-CARD"
	AccountTypePaylater   AccountType = "PAY-LATER"
)

func AccountTypes() []AccountType {
	return []AccountType{
		AccountTypeBank,
		AccountTypeEWallet,
		AccountTypeCash,
		AccountTypeCreditCard,
		AccountTypePaylater,
	}
}
