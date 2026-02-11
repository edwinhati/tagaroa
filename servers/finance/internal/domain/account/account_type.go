package account

import (
	"errors"
	"strings"
)

// AccountType represents the type of account
type AccountType string

const (
	AccountTypeBank       AccountType = "BANK"
	AccountTypeEWallet    AccountType = "E-WALLET"
	AccountTypeCash       AccountType = "CASH"
	AccountTypeCreditCard AccountType = "CREDIT-CARD"
	AccountTypePaylater   AccountType = "PAY-LATER"
)

// AllAccountTypes returns all valid account types
func AllAccountTypes() []AccountType {
	return []AccountType{
		AccountTypeBank,
		AccountTypeEWallet,
		AccountTypeCash,
		AccountTypeCreditCard,
		AccountTypePaylater,
	}
}

// IsValid checks if the account type is valid
func (t AccountType) IsValid() bool {
	switch t {
	case AccountTypeBank, AccountTypeEWallet, AccountTypeCash, AccountTypeCreditCard, AccountTypePaylater:
		return true
	default:
		return false
	}
}

// String returns the string representation
func (t AccountType) String() string {
	return string(t)
}

// ParseAccountType parses an account type from string
func ParseAccountType(s string) (AccountType, error) {
	s = strings.ToUpper(strings.TrimSpace(s))
	t := AccountType(s)
	if !t.IsValid() {
		return "", errors.New("invalid account type: " + s)
	}
	return t, nil
}
