package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTransactionTypes(t *testing.T) {
	types := TransactionTypes()

	assert.Len(t, types, 2)
	assert.Contains(t, types, TransactionTypeIncome)
	assert.Contains(t, types, TransactionTypeExpense)
}

func TestTransactionTypeConstants(t *testing.T) {
	assert.Equal(t, TransactionType("INCOME"), TransactionTypeIncome)
	assert.Equal(t, TransactionType("EXPENSE"), TransactionTypeExpense)
}
