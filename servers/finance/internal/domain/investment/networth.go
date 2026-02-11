package investment

import (
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/shared"
)

// NetWorth is a read model representing the calculated net worth
type NetWorth struct {
	UserID           shared.UserID
	TotalAssets      float64
	TotalLiabilities float64
	NetWorth         float64
	Currency         shared.Currency
	CalculatedAt     time.Time
}

// CalculateNetWorth calculates net worth from assets and liabilities
func CalculateNetWorth(
	userID shared.UserID,
	assets []*Asset,
	liabilities []*Liability,
	currency shared.Currency,
) *NetWorth {
	totalAssets := 0.0
	for _, asset := range assets {
		if !asset.IsDeleted() && asset.Currency() == currency {
			totalAssets += asset.Value()
		}
	}

	totalLiabilities := 0.0
	for _, liability := range liabilities {
		if !liability.IsDeleted() && liability.Currency() == currency {
			totalLiabilities += liability.RemainingAmount()
		}
	}

	return &NetWorth{
		UserID:           userID,
		TotalAssets:      totalAssets,
		TotalLiabilities: totalLiabilities,
		NetWorth:         totalAssets - totalLiabilities,
		Currency:         currency,
		CalculatedAt:     time.Now(),
	}
}
