package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLiabilityTypes(t *testing.T) {
	types := LiabilityTypes()

	assert.Len(t, types, 4)
	assert.Contains(t, types, LiabilityTypeMortgage)
	assert.Contains(t, types, LiabilityTypeLoan)
	assert.Contains(t, types, LiabilityTypeCreditCard)
	assert.Contains(t, types, LiabilityTypeOther)
}

func TestLiabilityTypeConstants(t *testing.T) {
	assert.Equal(t, LiabilityType("MORTGAGE"), LiabilityTypeMortgage)
	assert.Equal(t, LiabilityType("LOAN"), LiabilityTypeLoan)
	assert.Equal(t, LiabilityType("CREDIT-CARD"), LiabilityTypeCreditCard)
	assert.Equal(t, LiabilityType("OTHER"), LiabilityTypeOther)
}
