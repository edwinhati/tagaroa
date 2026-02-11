package budget

// BudgetCategory represents a budget category with type
type BudgetCategory struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

const (
	BudgetTypeMonthly   = "MONTHLY EXPENSE"
	BudgetTypeDaily     = "DAILY EXPENSE"
	BudgetTypeWeekly    = "WEEKLY EXPENSE"
	BudgetTypeLiability = "LIABILITY"
	BudgetTypeOther     = "OTHER"
)

// GetDefaultCategories returns the default budget categories
func GetDefaultCategories() []BudgetCategory {
	return []BudgetCategory{
		{Name: "Housing", Type: BudgetTypeMonthly},
		{Name: "Food", Type: BudgetTypeDaily},
		{Name: "Utilities", Type: BudgetTypeMonthly},
		{Name: "Transportation", Type: BudgetTypeDaily},
		{Name: "Hygiene", Type: BudgetTypeMonthly},
		{Name: "Laundry", Type: BudgetTypeWeekly},
		{Name: "Insurance", Type: BudgetTypeMonthly},
		{Name: "Installment", Type: BudgetTypeLiability},
		{Name: "Tithes", Type: BudgetTypeOther},
	}
}
