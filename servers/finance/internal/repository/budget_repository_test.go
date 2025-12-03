package repository

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

const (
	defaultBudgetMonth  = 1
	defaultBudgetYear   = 2024
	defaultBudgetAmount = 1000.0
	defaultBudgetID     = "00000000-0000-0000-0000-000000000000"
	defaultBudgetItemID = "11111111-1111-1111-1111-111111111111"
	defaultCategory     = "Housing"
)

func setupBudgetRepository(t *testing.T) (*sql.DB, sqlmock.Sqlmock, BudgetRepository) {
	db, mock := client.SetupMockDB(t)
	repo := NewBudgetRepository(db)
	return db, mock, repo
}

func TestBudgetRepositoryCreate(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	budget := &model.Budget{
		ID:       uuid.Nil, // No ID provided
		Month:    int(time.Now().Month()),
		Year:     int(time.Now().Year()),
		Amount:   1000.0,
		UserID:   uuid.New(),
		Currency: "USD",
	}

	mock.ExpectExec(`INSERT INTO budgets`).WithArgs(sqlmock.AnyArg(), budget.Month, budget.Year, budget.Amount, budget.UserID, budget.Currency, nil, sqlmock.AnyArg(), sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(1, 1))
	err := repo.Create(ctx, budget)

	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, budget.ID) // ID should be generated
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryCreateItem(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	budgetID := uuid.New()
	category := model.BudgetCategories()[0].Name

	item := &model.BudgetItem{
		ID:         uuid.Nil, // No ID provided
		Allocation: 1000.0,
		BudgetID:   &budgetID,
		Category:   category,
	}

	mock.ExpectExec(`INSERT INTO budget_items`).
		WithArgs(sqlmock.AnyArg(), item.Allocation, item.BudgetID, item.Category, nil, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	err := repo.CreateItem(ctx, item)

	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, item.ID) // ID should be generated
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryUpdate(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	budget := &model.Budget{
		ID:       uuid.MustParse(defaultBudgetID),
		Month:    defaultBudgetMonth,
		Year:     defaultBudgetYear,
		Amount:   defaultBudgetAmount,
		Currency: "USD",
	}

	mock.ExpectExec(`UPDATE budgets`).
		WithArgs(budget.Month, budget.Year, budget.Amount, budget.Currency, sqlmock.AnyArg(), budget.ID).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Update(ctx, budget)

	assert.NoError(t, err)
	assert.NotZero(t, budget.UpdatedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryUpdateItem(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	budgetID := uuid.MustParse(defaultBudgetID)
	item := &model.BudgetItem{
		ID:         uuid.MustParse(defaultBudgetItemID),
		Allocation: 50,
		BudgetID:   &budgetID,
		Category:   "Food",
	}

	mock.ExpectExec(`UPDATE budget_items`).
		WithArgs(item.Allocation, item.Category, sqlmock.AnyArg(), item.ID).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.UpdateItem(ctx, item)

	assert.NoError(t, err)
	assert.NotZero(t, item.UpdatedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryFindMany(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	createdAt := time.Now()
	updatedAt := time.Now()

	rows := sqlmock.NewRows([]string{
		"id", "month", "year", "amount", "user_id", "currency", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.MustParse(defaultBudgetID), defaultBudgetMonth, defaultBudgetYear, defaultBudgetAmount, userID, "USD", nil, createdAt, updatedAt,
	)

	mock.ExpectQuery(`SELECT (.+) FROM budgets WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY year ASC, month ASC`).
		WithArgs(userID).
		WillReturnRows(rows)

	budgets, err := repo.FindMany(ctx, util.FindManyParams{
		Where: map[string]any{"user_id": userID},
	})

	assert.NoError(t, err)
	assert.Len(t, budgets, 1)
	assert.Equal(t, userID, budgets[0].UserID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryFindUnique(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	budgetID := uuid.MustParse(defaultBudgetID)
	userID := uuid.New()
	createdAt := time.Now()
	updatedAt := time.Now()

	budgetRows := sqlmock.NewRows([]string{
		"id", "month", "year", "amount", "user_id", "currency", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		budgetID, defaultBudgetMonth, defaultBudgetYear, defaultBudgetAmount, userID, "USD", nil, createdAt, updatedAt,
	)

	itemRows := sqlmock.NewRows([]string{
		"id", "allocation", "budget_id", "category", "deleted_at", "created_at", "updated_at",
	}).AddRow(uuid.New(), 10.0, budgetID, "Housing", nil, createdAt, updatedAt).
		AddRow(uuid.New(), 20.0, budgetID, "Food", nil, createdAt, updatedAt)

	mock.ExpectQuery(`SELECT (.+) FROM budgets WHERE deleted_at IS NULL AND id = \$1 AND user_id = \$2 LIMIT 1`).
		WithArgs(budgetID, userID).
		WillReturnRows(budgetRows)

	mock.ExpectQuery(`SELECT (.+) FROM budget_items WHERE deleted_at IS NULL AND budget_id = \$1 ORDER BY category ASC`).
		WithArgs(budgetID).
		WillReturnRows(itemRows)

	budget, err := repo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{
			"id":      budgetID,
			"user_id": userID,
		},
	})

	assert.NoError(t, err)
	assert.NotNil(t, budget)
	assert.Equal(t, budgetID, budget.ID)
	assert.Len(t, budget.BudgetItems, 2)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryCount(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM budgets WHERE deleted_at IS NULL AND user_id = \$1`).
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	count, err := repo.Count(ctx, map[string]any{
		"user_id": userID,
	})

	assert.NoError(t, err)
	assert.Equal(t, 2, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryCountNoRows(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM budgets WHERE deleted_at IS NULL AND user_id = \$1`).
		WithArgs(userID).
		WillReturnError(sql.ErrNoRows)

	count, err := repo.Count(ctx, map[string]any{
		"user_id": userID,
	})

	assert.NoError(t, err)
	assert.Equal(t, 0, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryCountError(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM budgets WHERE deleted_at IS NULL AND user_id = \$1`).
		WithArgs(userID).
		WillReturnError(fmt.Errorf("count err"))

	count, err := repo.Count(ctx, map[string]any{
		"user_id": userID,
	})

	assert.Error(t, err)
	assert.Equal(t, 0, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryFindManyWithPagination(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	now := time.Now()

	rows := sqlmock.NewRows([]string{
		"id", "month", "year", "amount", "user_id", "currency", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), 2, 2025, 500.0, userID, "EUR", nil, now, now,
	)

	mock.ExpectQuery(`SELECT (.+) FROM budgets WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY year ASC, month ASC OFFSET \$2 LIMIT \$3`).
		WithArgs(userID, 5, 5).
		WillReturnRows(rows)

	budgets, err := repo.FindMany(ctx, util.FindManyParams{
		Where:  map[string]any{"user_id": userID},
		Offset: 5,
		Limit:  5,
	})

	assert.NoError(t, err)
	assert.Len(t, budgets, 1)
	assert.Equal(t, userID, budgets[0].UserID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryFindManyQueryError(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	mock.ExpectQuery(`SELECT (.+) FROM budgets WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY year ASC, month ASC`).
		WithArgs(userID).
		WillReturnError(fmt.Errorf("query err"))

	budgets, err := repo.FindMany(ctx, util.FindManyParams{
		Where: map[string]any{"user_id": userID},
	})

	assert.Error(t, err)
	assert.Nil(t, budgets)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryFindManyScanError(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	rows := sqlmock.NewRows([]string{
		"id", "month", "year", "amount", "user_id", "currency", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		"bad-uuid", 2, 2025, 500.0, userID, "EUR", nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM budgets WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY year ASC, month ASC`).
		WithArgs(userID).
		WillReturnRows(rows)

	budgets, err := repo.FindMany(ctx, util.FindManyParams{
		Where: map[string]any{"user_id": userID},
	})

	assert.Error(t, err)
	assert.Nil(t, budgets)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryFindManyRowsError(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	now := time.Now()

	rows := sqlmock.NewRows([]string{
		"id", "month", "year", "amount", "user_id", "currency", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), 2, 2025, 500.0, userID, "EUR", nil, now, now,
	).RowError(0, fmt.Errorf("row err"))

	mock.ExpectQuery(`SELECT (.+) FROM budgets WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY year ASC, month ASC`).
		WithArgs(userID).
		WillReturnRows(rows)

	budgets, err := repo.FindMany(ctx, util.FindManyParams{
		Where: map[string]any{"user_id": userID},
	})

	assert.Error(t, err)
	assert.Nil(t, budgets)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryFindUniqueNotFound(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	budgetID := uuid.New()
	userID := uuid.New()

	mock.ExpectQuery(`SELECT (.+) FROM budgets WHERE deleted_at IS NULL AND id = \$1 AND user_id = \$2 LIMIT 1`).
		WithArgs(budgetID, userID).
		WillReturnError(sql.ErrNoRows)

	budget, err := repo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{
			"id":      budgetID,
			"user_id": userID,
		},
	})

	assert.NoError(t, err)
	assert.Nil(t, budget)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryFindUniqueScanError(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	budgetID := uuid.New()
	userID := uuid.New()

	rows := sqlmock.NewRows([]string{
		"id", "month", "year", "amount", "user_id", "currency", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		123, "bad", 2025, 500.0, userID, "USD", nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM budgets WHERE deleted_at IS NULL AND id = \$1 AND user_id = \$2 LIMIT 1`).
		WithArgs(budgetID, userID).
		WillReturnRows(rows)

	budget, err := repo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{
			"id":      budgetID,
			"user_id": userID,
		},
	})

	assert.Error(t, err)
	assert.Nil(t, budget)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryFindUniqueBudgetItemsScanError(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	budgetID := uuid.New()
	userID := uuid.New()
	now := time.Now()

	budgetRows := sqlmock.NewRows([]string{
		"id", "month", "year", "amount", "user_id", "currency", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		budgetID, 1, 2024, 100.0, userID, "USD", nil, now, now,
	)

	itemRows := sqlmock.NewRows([]string{
		"id", "allocation", "budget_id", "category", "deleted_at", "created_at", "updated_at",
	}).AddRow("bad-uuid", 10.0, budgetID, "Housing", nil, now, now)

	mock.ExpectQuery(`SELECT (.+) FROM budgets WHERE deleted_at IS NULL AND id = \$1 AND user_id = \$2 LIMIT 1`).
		WithArgs(budgetID, userID).
		WillReturnRows(budgetRows)

	mock.ExpectQuery(`SELECT (.+) FROM budget_items WHERE deleted_at IS NULL AND budget_id = \$1 ORDER BY category ASC`).
		WithArgs(budgetID).
		WillReturnRows(itemRows)

	budget, err := repo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{
			"id":      budgetID,
			"user_id": userID,
		},
	})

	assert.Error(t, err)
	assert.Nil(t, budget)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryFindUniqueRowsError(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	budgetID := uuid.New()
	userID := uuid.New()
	now := time.Now()

	budgetRows := sqlmock.NewRows([]string{
		"id", "month", "year", "amount", "user_id", "currency", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		budgetID, 1, 2024, 100.0, userID, "USD", nil, now, now,
	)

	itemRows := sqlmock.NewRows([]string{
		"id", "allocation", "budget_id", "category", "deleted_at", "created_at", "updated_at",
	}).AddRow(uuid.New(), 10.0, budgetID, "Housing", nil, now, now).
		RowError(0, fmt.Errorf("rows err"))

	mock.ExpectQuery(`SELECT (.+) FROM budgets WHERE deleted_at IS NULL AND id = \$1 AND user_id = \$2 LIMIT 1`).
		WithArgs(budgetID, userID).
		WillReturnRows(budgetRows)

	mock.ExpectQuery(`SELECT (.+) FROM budget_items WHERE deleted_at IS NULL AND budget_id = \$1 ORDER BY category ASC`).
		WithArgs(budgetID).
		WillReturnRows(itemRows)

	budget, err := repo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{
			"id":      budgetID,
			"user_id": userID,
		},
	})

	assert.Error(t, err)
	assert.Nil(t, budget)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBudgetRepositoryFindUniqueQueryError(t *testing.T) {
	db, mock, repo := setupBudgetRepository(t)
	defer db.Close()

	ctx := context.Background()
	budgetID := uuid.New()
	userID := uuid.New()
	now := time.Now()

	budgetRows := sqlmock.NewRows([]string{
		"id", "month", "year", "amount", "user_id", "currency", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		budgetID, 1, 2024, 100.0, userID, "USD", nil, now, now,
	)

	mock.ExpectQuery(`SELECT (.+) FROM budgets WHERE deleted_at IS NULL AND id = \$1 AND user_id = \$2 LIMIT 1`).
		WithArgs(budgetID, userID).
		WillReturnRows(budgetRows)

	mock.ExpectQuery(`SELECT (.+) FROM budget_items WHERE deleted_at IS NULL AND budget_id = \$1 ORDER BY category ASC`).
		WithArgs(budgetID).
		WillReturnError(fmt.Errorf("query err"))

	budget, err := repo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{
			"id":      budgetID,
			"user_id": userID,
		},
	})

	assert.Error(t, err)
	assert.Nil(t, budget)
	assert.NoError(t, mock.ExpectationsWereMet())
}

type sliceRowScanner [][]any

func (s sliceRowScanner) Scan(dest ...any) error {
	if len(s) == 0 {
		return fmt.Errorf("no rows")
	}
	row := s[0]
	if len(row) != len(dest) {
		return fmt.Errorf("mismatched dest len")
	}
	for i, d := range dest {
		switch target := d.(type) {
		case *uuid.UUID:
			*target = row[i].(uuid.UUID)
		case **uuid.UUID:
			id := row[i].(uuid.UUID)
			*target = &id
		case *int:
			*target = row[i].(int)
		case *float64:
			*target = row[i].(float64)
		case *string:
			*target = row[i].(string)
		case *sql.NullTime:
			*target = row[i].(sql.NullTime)
		case *time.Time:
			*target = row[i].(time.Time)
		default:
			return fmt.Errorf("unsupported type %T", d)
		}
	}
	return nil
}

func TestScanBudgetSetsDeletedAt(t *testing.T) {
	now := time.Now()
	budgetID := uuid.New()
	userID := uuid.New()
	rows := sliceRowScanner{{
		budgetID,
		1,
		2024,
		100.0,
		userID,
		"USD",
		sql.NullTime{Time: now, Valid: true},
		now,
		now,
	}}

	budget, err := scanBudget(rows)
	assert.NoError(t, err)
	assert.NotNil(t, budget.DeletedAt)
}

func TestScanBudgetItemSetsDeletedAt(t *testing.T) {
	now := time.Now()
	itemID := uuid.New()
	budgetID := uuid.New()
	rows := sliceRowScanner{{
		itemID,
		50.0,
		budgetID,
		"Food",
		sql.NullTime{Time: now, Valid: true},
		now,
		now,
	}}

	item, err := scanBudgetItem(rows)
	assert.NoError(t, err)
	assert.NotNil(t, item.DeletedAt)
}

func TestScanBudgetItemScanError(t *testing.T) {
	_, err := scanBudgetItem(sliceRowScanner{})
	assert.Error(t, err)
}
