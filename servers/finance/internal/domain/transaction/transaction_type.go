package transaction

import (
	"errors"
	"strings"
)

// TransactionType represents the type of transaction
type TransactionType string

const (
	TransactionTypeIncome  TransactionType = "INCOME"
	TransactionTypeExpense TransactionType = "EXPENSE"
)

// AllTransactionTypes returns all valid transaction types
func AllTransactionTypes() []TransactionType {
	return []TransactionType{
		TransactionTypeIncome,
		TransactionTypeExpense,
	}
}

// IsValid checks if the transaction type is valid
func (t TransactionType) IsValid() bool {
	switch t {
	case TransactionTypeIncome, TransactionTypeExpense:
		return true
	default:
		return false
	}
}

// String returns the string representation
func (t TransactionType) String() string {
	return string(t)
}

// IsIncome returns true if this is an income transaction
func (t TransactionType) IsIncome() bool {
	return t == TransactionTypeIncome
}

// IsExpense returns true if this is an expense transaction
func (t TransactionType) IsExpense() bool {
	return t == TransactionTypeExpense
}

// ParseTransactionType parses a transaction type from string
func ParseTransactionType(s string) (TransactionType, error) {
	s = strings.ToUpper(strings.TrimSpace(s))
	t := TransactionType(s)
	if !t.IsValid() {
		return "", errors.New("invalid transaction type: " + s)
	}
	return t, nil
}
