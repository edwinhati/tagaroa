package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBudgetCategories(t *testing.T) {
	categories := BudgetCategories()

	assert.Len(t, categories, 9)

	expectedCategories := []BudgetCategory{
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

	for _, expected := range expectedCategories {
		assert.Contains(t, categories, expected)
	}
}

func TestBudgetCategoryStructure(t *testing.T) {
	categories := BudgetCategories()

	// Test that each category has the expected structure
	for _, category := range categories {
		assert.NotEmpty(t, category.Name)
		assert.NotEmpty(t, category.Type)
	}

	// Test specific categories
	housingCategory := BudgetCategory{Name: "Housing", Type: budgetTypeMonthly}
	assert.Contains(t, categories, housingCategory)

	foodCategory := BudgetCategory{Name: "Food", Type: budgetTypeDaily}
	assert.Contains(t, categories, foodCategory)
}

func TestBudgetTableName(t *testing.T) {
	budget := Budget{}
	assert.Equal(t, "budgets", budget.TableName())
}

func TestBudgetItemTableName(t *testing.T) {
	budgetItem := BudgetItem{}
	assert.Equal(t, "budget_items", budgetItem.TableName())
}
