package model

import (
	"time"

	"github.com/google/uuid"
)

type TransactionType string

type Transaction struct {
	ID           uuid.UUID       `json:"id"`
	Amount       float64         `json:"amount"`
	Date         time.Time       `json:"date"`
	Type         TransactionType `json:"type"`
	Currency     string          `json:"currency"`
	Notes        *string         `json:"notes,omitempty"`
	Files        []string        `json:"files,omitempty"`
	UserID       uuid.UUID       `json:"user_id"`
	AccountID    uuid.UUID       `json:"account_id"`
	BudgetItemID *uuid.UUID      `json:"budget_item_id"`
	DeletedAt    *time.Time      `json:"deleted_at,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
	Account      *Account        `json:"account,omitempty"`
	BudgetItem   *BudgetItem     `json:"budget_item,omitempty"`
}

const (
	TransactionTypeIncome  TransactionType = "INCOME"
	TransactionTypeExpense TransactionType = "EXPENSE"
)

func TransactionTypes() []TransactionType {
	return []TransactionType{
		TransactionTypeIncome,
		TransactionTypeExpense,
	}
}
