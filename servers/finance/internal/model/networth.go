package model

import (
	"time"

	"github.com/google/uuid"
)

type NetworthHistory struct {
	ID               uuid.UUID `json:"id"`
	Time             time.Time `json:"time"`
	UserID           uuid.UUID `json:"user_id"`
	TotalAssets      float64   `json:"total_assets"`
	TotalLiabilities float64   `json:"total_liabilities"`
	Networth         float64   `json:"networth"`
	Currency         string    `json:"currency"`
}
