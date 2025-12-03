package model

import (
	"time"

	"github.com/google/uuid"
)

type Budget struct {
	ID          uuid.UUID    `json:"id"`
	Month       int          `json:"month"`
	Year        int          `json:"year"`
	Amount      float64      `json:"amount"`
	UserID      uuid.UUID    `json:"user_id"`
	Currency    string       `json:"currency"`
	DeletedAt   *time.Time   `json:"deleted_at,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
	BudgetItems []BudgetItem `json:"items,omitempty"`
}

func (Budget) TableName() string { return "budgets" }

type BudgetItem struct {
	ID         uuid.UUID  `json:"id"`
	Allocation float64    `json:"allocation"`
	BudgetID   *uuid.UUID `json:"budget_id"`
	Category   string     `json:"category"`
	DeletedAt  *time.Time `json:"deleted_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

func (BudgetItem) TableName() string {
	return "budget_items"
}

type BudgetCategory struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

const (
	budgetTypeMonthly   = "MONTHLY EXPENSE"
	budgetTypeDaily     = "DAILY EXPENSE"
	budgetTypeWeekly    = "WEEKLY EXPENSE"
	budgetTypeLiability = "LIABILITY"
	budgetTypeOther     = "OTHER"
)

func BudgetCategories() []BudgetCategory {
	return []BudgetCategory{
		{Name: "Housing", Type: budgetTypeMonthly},
		{Name: "Food", Type: budgetTypeDaily},
		{Name: "Utilities", Type: budgetTypeMonthly},
		{Name: "Transportation", Type: budgetTypeDaily},
		{Name: "Hygiene", Type: budgetTypeMonthly},
		{Name: "Laundry", Type: budgetTypeWeekly},
		{Name: "Insurance", Type: budgetTypeMonthly},
		{Name: "Installment", Type: budgetTypeLiability},
		{Name: "Tithes", Type: budgetTypeOther},
	}
}
