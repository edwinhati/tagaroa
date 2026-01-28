package model

import (
	"time"

	"github.com/google/uuid"
)

type AssetType string

type Asset struct {
	ID        uuid.UUID  `json:"id"`
	Name      string     `json:"name"`
	Type      AssetType  `json:"type"`
	Value     float64    `json:"value"`
	Shares    *float64   `json:"shares,omitempty"`
	Ticker    *string    `json:"ticker,omitempty"`
	Currency  string     `json:"currency"`
	UserID    uuid.UUID  `json:"user_id"`
	Notes     *string    `json:"notes,omitempty"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

const (
	AssetTypeCrypto     AssetType = "CRYPTO"
	AssetTypeStock      AssetType = "STOCK"
	AssetTypeMutualFund AssetType = "MUTUAL-FUND"
	AssetTypeCommodity  AssetType = "COMMODITY"
	AssetTypeForex      AssetType = "FOREX"
	AssetTypeOther      AssetType = "OTHER"
)

func AssetTypes() []AssetType {
	return []AssetType{
		AssetTypeCrypto,
		AssetTypeStock,
		AssetTypeMutualFund,
		AssetTypeCommodity,
		AssetTypeForex,
		AssetTypeOther,
	}
}
