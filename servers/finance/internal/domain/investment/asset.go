package investment

import (
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
	"github.com/google/uuid"
)

// AssetType represents the type of investment asset
type AssetType string

const (
	AssetTypeStocks     AssetType = "STOCKS"
	AssetTypeBonds      AssetType = "BONDS"
	AssetTypeMutualFund AssetType = "MUTUAL_FUND"
	AssetTypeETF        AssetType = "ETF"
	AssetTypeRealEstate AssetType = "REAL_ESTATE"
	AssetTypeCrypto     AssetType = "CRYPTO"
	AssetTypeCash       AssetType = "CASH"
	AssetTypeOther      AssetType = "OTHER"
)

// AllAssetTypes returns all valid asset types
func AllAssetTypes() []AssetType {
	return []AssetType{
		AssetTypeStocks,
		AssetTypeBonds,
		AssetTypeMutualFund,
		AssetTypeETF,
		AssetTypeRealEstate,
		AssetTypeCrypto,
		AssetTypeCash,
		AssetTypeOther,
	}
}

// IsValid checks if the asset type is valid
func (t AssetType) IsValid() bool {
	switch t {
	case AssetTypeStocks, AssetTypeBonds, AssetTypeMutualFund, AssetTypeETF,
		AssetTypeRealEstate, AssetTypeCrypto, AssetTypeCash, AssetTypeOther:
		return true
	default:
		return false
	}
}

// Asset is an aggregate root representing an investment asset
type Asset struct {
	id           uuid.UUID
	name         string
	assetType    AssetType
	value        float64
	currency     shared.Currency
	userID       shared.UserID
	purchaseDate *time.Time
	notes        *string
	deletedAt    *time.Time
	createdAt    time.Time
	updatedAt    time.Time
	version      int
}

// NewAsset creates a new Asset aggregate
func NewAsset(
	name string,
	assetType AssetType,
	value float64,
	currency shared.Currency,
	userID shared.UserID,
	purchaseDate *time.Time,
	notes *string,
) (*Asset, error) {
	if name == "" {
		return nil, ErrNameRequired
	}
	if !assetType.IsValid() {
		return nil, ErrInvalidType
	}
	if value <= 0 {
		return nil, ErrInvalidValue
	}
	if !currency.IsValid() {
		return nil, ErrInvalidCurrency
	}
	if userID.IsZero() {
		return nil, ErrUserIDRequired
	}

	asset := &Asset{
		id:           uuid.New(),
		name:         name,
		assetType:    assetType,
		value:        value,
		currency:     currency,
		userID:       userID,
		purchaseDate: purchaseDate,
		notes:        notes,
		createdAt:    time.Now(),
		updatedAt:    time.Now(),
		version:      1,
	}

	return asset, nil
}

// RestoreAsset restores an Asset from persistence
func RestoreAsset(
	id uuid.UUID,
	name string,
	assetType AssetType,
	value float64,
	currency shared.Currency,
	userID shared.UserID,
	purchaseDate *time.Time,
	notes *string,
	deletedAt *time.Time,
	createdAt time.Time,
	updatedAt time.Time,
	version int,
) *Asset {
	return &Asset{
		id:           id,
		name:         name,
		assetType:    assetType,
		value:        value,
		currency:     currency,
		userID:       userID,
		purchaseDate: purchaseDate,
		notes:        notes,
		deletedAt:    deletedAt,
		createdAt:    createdAt,
		updatedAt:    updatedAt,
		version:      version,
	}
}

// Getters
func (a *Asset) ID() uuid.UUID             { return a.id }
func (a *Asset) Name() string              { return a.name }
func (a *Asset) Type() AssetType           { return a.assetType }
func (a *Asset) Value() float64            { return a.value }
func (a *Asset) Currency() shared.Currency { return a.currency }
func (a *Asset) UserID() shared.UserID     { return a.userID }
func (a *Asset) PurchaseDate() *time.Time  { return a.purchaseDate }
func (a *Asset) Notes() *string            { return a.notes }
func (a *Asset) DeletedAt() *time.Time     { return a.deletedAt }
func (a *Asset) CreatedAt() time.Time      { return a.createdAt }
func (a *Asset) UpdatedAt() time.Time      { return a.updatedAt }
func (a *Asset) Version() int              { return a.version }

// IsDeleted returns true if the asset is soft-deleted
func (a *Asset) IsDeleted() bool {
	return a.deletedAt != nil
}

// UpdateValue updates the asset value
func (a *Asset) UpdateValue(value float64) error {
	if a.IsDeleted() {
		return ErrAssetDeleted
	}
	if value <= 0 {
		return ErrInvalidValue
	}
	a.value = value
	a.updatedAt = time.Now()
	a.version++
	return nil
}

// UpdateName updates the asset name
func (a *Asset) UpdateName(name string) error {
	if a.IsDeleted() {
		return ErrAssetDeleted
	}
	if name == "" {
		return ErrNameRequired
	}
	a.name = name
	a.updatedAt = time.Now()
	a.version++
	return nil
}

// UpdateType updates the asset type
func (a *Asset) UpdateType(assetType AssetType) error {
	if a.IsDeleted() {
		return ErrAssetDeleted
	}
	if !assetType.IsValid() {
		return ErrInvalidType
	}
	a.assetType = assetType
	a.updatedAt = time.Now()
	a.version++
	return nil
}

// UpdateNotes updates the asset notes
func (a *Asset) UpdateNotes(notes *string) error {
	if a.IsDeleted() {
		return ErrAssetDeleted
	}
	a.notes = notes
	a.updatedAt = time.Now()
	a.version++
	return nil
}

// SoftDelete marks the asset as deleted
func (a *Asset) SoftDelete() error {
	if a.IsDeleted() {
		return ErrAssetDeleted
	}
	now := time.Now()
	a.deletedAt = &now
	a.updatedAt = now
	a.version++
	return nil
}
