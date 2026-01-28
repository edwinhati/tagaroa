package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAssetTypes(t *testing.T) {
	types := AssetTypes()

	assert.Len(t, types, 6)
	assert.Contains(t, types, AssetTypeCrypto)
	assert.Contains(t, types, AssetTypeStock)
	assert.Contains(t, types, AssetTypeMutualFund)
	assert.Contains(t, types, AssetTypeCommodity)
	assert.Contains(t, types, AssetTypeForex)
	assert.Contains(t, types, AssetTypeOther)
}

func TestAssetTypeConstants(t *testing.T) {
	assert.Equal(t, AssetType("CRYPTO"), AssetTypeCrypto)
	assert.Equal(t, AssetType("STOCK"), AssetTypeStock)
	assert.Equal(t, AssetType("MUTUAL-FUND"), AssetTypeMutualFund)
	assert.Equal(t, AssetType("COMMODITY"), AssetTypeCommodity)
	assert.Equal(t, AssetType("FOREX"), AssetTypeForex)
	assert.Equal(t, AssetType("OTHER"), AssetTypeOther)
}
