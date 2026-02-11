package investment

import "github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"

// Domain errors
var (
	ErrNameRequired        = &shared.DomainError{Code: "NAME_REQUIRED", Message: "name is required"}
	ErrInvalidType         = &shared.DomainError{Code: "INVALID_TYPE", Message: "invalid type"}
	ErrInvalidValue        = &shared.DomainError{Code: "INVALID_VALUE", Message: "value must be positive"}
	ErrInvalidAmount       = &shared.DomainError{Code: "INVALID_AMOUNT", Message: "amount must be positive"}
	ErrInvalidCurrency     = &shared.DomainError{Code: "INVALID_CURRENCY", Message: "invalid currency"}
	ErrUserIDRequired      = &shared.DomainError{Code: "USER_ID_REQUIRED", Message: "user ID is required"}
	ErrAssetDeleted        = &shared.DomainError{Code: "ASSET_DELETED", Message: "asset is deleted"}
	ErrInvalidPayment      = &shared.DomainError{Code: "INVALID_PAYMENT", Message: "payment must be positive"}
	ErrInvalidInterestRate = &shared.DomainError{Code: "INVALID_INTEREST_RATE", Message: "interest rate must be between 0 and 100"}
	ErrLiabilityDeleted    = &shared.DomainError{Code: "LIABILITY_DELETED", Message: "liability is deleted"}
)
