package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAccountTypes(t *testing.T) {
	types := AccountTypes()

	assert.Len(t, types, 5)
	assert.Contains(t, types, AccountTypeBank)
	assert.Contains(t, types, AccountTypeEWallet)
	assert.Contains(t, types, AccountTypeCash)
	assert.Contains(t, types, AccountTypeCreditCard)
	assert.Contains(t, types, AccountTypePaylater)
}

func TestAccountTypeConstants(t *testing.T) {
	assert.Equal(t, AccountType("BANK"), AccountTypeBank)
	assert.Equal(t, AccountType("E-WALLET"), AccountTypeEWallet)
	assert.Equal(t, AccountType("CASH"), AccountTypeCash)
	assert.Equal(t, AccountType("CREDIT-CARD"), AccountTypeCreditCard)
	assert.Equal(t, AccountType("PAY-LATER"), AccountTypePaylater)
}
