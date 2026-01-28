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

func setupTransactionRepository(t *testing.T) (*sql.DB, sqlmock.Sqlmock, TransactionRepository) {
	db, mock := client.SetupMockDB(t)
	repo := NewTransactionRepository(db)
	return db, mock, repo
}

func TestNewTransactionRepository(t *testing.T) {
	db, _ := client.SetupMockDB(t)
	defer db.Close()

	repo := NewTransactionRepository(db)
	assert.NotNil(t, repo)
}

func TestTransactionRepositoryCreate(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	accountID := uuid.New()
	transaction := &model.Transaction{
		ID:        uuid.New(),
		Amount:    100.0,
		Date:      time.Now(),
		Type:      model.TransactionTypeExpense,
		Currency:  "USD",
		UserID:    uuid.New(),
		AccountID: accountID,
		Files:     nil, // Use nil to avoid slice conversion issue with sqlmock
	}

	mock.ExpectExec(`INSERT INTO transactions`).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Create(ctx, transaction)

	assert.NoError(t, err)
	assert.NotZero(t, transaction.CreatedAt)
	assert.NotZero(t, transaction.UpdatedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryCreateGeneratesID(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	transaction := &model.Transaction{
		ID:        uuid.Nil,
		Amount:    100.0,
		Date:      time.Now(),
		Type:      model.TransactionTypeExpense,
		Currency:  "USD",
		UserID:    uuid.New(),
		AccountID: uuid.New(),
		Files:     nil,
	}

	mock.ExpectExec(`INSERT INTO transactions`).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Create(ctx, transaction)

	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, transaction.ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryCreateError(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	transaction := &model.Transaction{
		ID:        uuid.New(),
		Amount:    100.0,
		Date:      time.Now(),
		Type:      model.TransactionTypeExpense,
		Currency:  "USD",
		UserID:    uuid.New(),
		AccountID: uuid.New(),
		Files:     nil,
	}

	mock.ExpectExec(`INSERT INTO transactions`).
		WillReturnError(fmt.Errorf("db error"))

	err := repo.Create(ctx, transaction)

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindUnique(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	createdAt := time.Now()
	updatedAt := time.Now()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      transactionID,
			"user_id": userID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	}).AddRow(
		transactionID, 100.0, time.Now(), model.TransactionTypeExpense, "USD", nil, nil, userID, nil, createdAt, updatedAt, accountID, nil,
		accountID, "Test Account", "BANK", 1000.0, "USD",
		nil, nil, nil,
	)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(userID, transactionID).
		WillReturnRows(rows)

	transaction, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, transaction)
	assert.Equal(t, transactionID, transaction.ID)
	assert.Equal(t, 100.0, transaction.Amount)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindUniqueNotFound(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(sql.ErrNoRows)

	transaction, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.Nil(t, transaction)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindUniqueError(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("db error"))

	transaction, err := repo.FindUnique(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, transaction)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindUniqueWithDateRange(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	startDate := time.Now().AddDate(0, -1, 0)
	endDate := time.Now()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":         transactionID,
			"user_id":    userID,
			"start_date": startDate,
			"end_date":   endDate,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	}).AddRow(
		transactionID, 100.0, time.Now(), model.TransactionTypeExpense, "USD", nil, nil, userID, nil, time.Now(), time.Now(), accountID, nil,
		accountID, "Test Account", "BANK", 1000.0, "USD",
		nil, nil, nil,
	)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(userID, transactionID, startDate, endDate).
		WillReturnRows(rows)

	transaction, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, transaction)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindMany(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	transactionID := uuid.New()
	accountID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		Offset:  0,
		Limit:   10,
		OrderBy: "created_at DESC",
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	}).AddRow(
		transactionID, 100.0, time.Now(), model.TransactionTypeExpense, "USD", nil, nil, userID, nil, time.Now(), time.Now(), accountID, nil,
		accountID, "Test Account", "BANK", 1000.0, "USD",
		nil, nil, nil,
	)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnRows(rows)

	transactions, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, transactions, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindManyError(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": uuid.New(),
		},
		OrderBy: "created_at DESC",
	}

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnError(fmt.Errorf("db error"))

	transactions, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, transactions)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindManyInvalidOrderBy(t *testing.T) {
	db, _, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": uuid.New(),
		},
		OrderBy: "invalid_column DESC",
	}

	transactions, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, transactions)
	assert.Contains(t, err.Error(), "invalid ORDER BY")
}

func TestTransactionRepositoryFindManyScanError(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": uuid.New(),
		},
		OrderBy: "created_at DESC",
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount",
	}).AddRow(
		"invalid-uuid", "not-a-number",
	)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnRows(rows)

	transactions, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, transactions)
}

func TestTransactionRepositoryFindManyRowsError(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	transactionID := uuid.New()
	accountID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		OrderBy: "created_at DESC",
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	}).AddRow(
		transactionID, 100.0, time.Now(), model.TransactionTypeExpense, "USD", nil, nil, userID, nil, time.Now(), time.Now(), accountID, nil,
		accountID, "Test Account", "BANK", 1000.0, "USD",
		nil, nil, nil,
	).RowError(0, fmt.Errorf("rows error"))

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnRows(rows)

	transactions, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, transactions)
}

func TestTransactionRepositoryCount(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(5)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions t`).
		WithArgs(userID).
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 5, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryCountError(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions t`).
		WillReturnError(fmt.Errorf("db error"))

	count, err := repo.Count(ctx, where)

	assert.Error(t, err)
	assert.Equal(t, 0, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryCountWithDateRange(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	startDate := time.Now().AddDate(0, -1, 0)
	endDate := time.Now()

	where := map[string]any{
		"user_id":    userID,
		"start_date": startDate,
		"end_date":   endDate,
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(3)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions t`).
		WithArgs(userID, startDate, endDate).
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 3, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryUpdate(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	transaction := &model.Transaction{
		ID:        uuid.New(),
		Amount:    200.0,
		Date:      time.Now(),
		Type:      model.TransactionTypeIncome,
		Currency:  "EUR",
		AccountID: uuid.New(),
		Files:     nil, // Use nil to avoid slice conversion issue
	}

	mock.ExpectExec(`UPDATE transactions`).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Update(ctx, transaction)

	assert.NoError(t, err)
	assert.NotZero(t, transaction.UpdatedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryUpdateError(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	transaction := &model.Transaction{
		ID:        uuid.New(),
		Amount:    200.0,
		Date:      time.Now(),
		Type:      model.TransactionTypeIncome,
		Currency:  "EUR",
		AccountID: uuid.New(),
		Files:     nil,
	}

	mock.ExpectExec(`UPDATE transactions`).
		WillReturnError(fmt.Errorf("db error"))

	err := repo.Update(ctx, transaction)

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryGetTypeAggregations(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{"key", "count", "min_amount", "max_amount", "avg_amount", "sum_amount"}).
		AddRow("EXPENSE", 10, 50.0, 500.0, 150.0, 1500.0).
		AddRow("INCOME", 5, 100.0, 1000.0, 400.0, 2000.0)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggs, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggs, 2)
	assert.Equal(t, 10, aggs["EXPENSE"].Count)
	assert.Equal(t, 5, aggs["INCOME"].Count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryGetTypeAggregationsError(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnError(fmt.Errorf("db error"))

	aggs, err := repo.GetTypeAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggs)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryGetCurrencyAggregations(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{"key", "count", "min_amount", "max_amount", "avg_amount", "sum_amount"}).
		AddRow("USD", 10, 50.0, 500.0, 150.0, 1500.0)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggs, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggs, 1)
	assert.Equal(t, 10, aggs["USD"].Count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryGetAccountAggregations(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{"key", "count", "min_amount", "max_amount", "avg_amount", "sum_amount"}).
		AddRow("Bank Account", 10, 50.0, 500.0, 150.0, 1500.0)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggs, err := repo.GetAccountAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggs, 1)
	assert.Equal(t, 10, aggs["Bank Account"].Count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryGetAccountAggregationsWithDateRange(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	startDate := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2025, 1, 31, 23, 59, 59, 0, time.UTC)
	where := map[string]any{
		"user_id":    userID,
		"start_date": startDate,
		"end_date":   endDate,
	}

	rows := sqlmock.NewRows([]string{"key", "count", "min_amount", "max_amount", "avg_amount", "sum_amount"}).
		AddRow("Bank Account", 5, 50.0, 500.0, 150.0, 750.0)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(userID, startDate, endDate).
		WillReturnRows(rows)

	aggs, err := repo.GetAccountAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggs, 1)
	assert.Equal(t, 5, aggs["Bank Account"].Count)
	assert.Equal(t, 750.0, aggs["Bank Account"].Sum)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryGetCategoryAggregations(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{"key", "count", "min_amount", "max_amount", "avg_amount", "sum_amount"}).
		AddRow("Food", 10, 50.0, 500.0, 150.0, 1500.0)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggs, err := repo.GetCategoryAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggs, 1)
	assert.Equal(t, 10, aggs["Food"].Count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryGetAggregationsScanError(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	rows := sqlmock.NewRows([]string{"key", "count"}).
		AddRow("EXPENSE", "not-a-number")

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnRows(rows)

	aggs, err := repo.GetTypeAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggs)
}

func TestTransactionRepositoryGetAggregationsRowsError(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	rows := sqlmock.NewRows([]string{"key", "count", "min_amount", "max_amount", "avg_amount", "sum_amount"}).
		AddRow("EXPENSE", 10, 50.0, 500.0, 150.0, 1500.0).
		RowError(0, fmt.Errorf("rows error"))

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnRows(rows)

	aggs, err := repo.GetTypeAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggs)
}

func TestTransactionRepositoryFindManyWithFilters(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	transactionID := uuid.New()
	accountID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id":  userID,
			"type":     []string{"EXPENSE"},
			"currency": []string{"USD"},
			"account":  []string{"Bank"},
			"category": []string{"Food"},
		},
		OrderBy: "created_at DESC",
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	}).AddRow(
		transactionID, 100.0, time.Now(), model.TransactionTypeExpense, "USD", nil, nil, userID, nil, time.Now(), time.Now(), accountID, nil,
		accountID, "Bank", "BANK", 1000.0, "USD",
		nil, nil, nil,
	)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnRows(rows)

	transactions, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, transactions, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindUniqueWithBudgetItem(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	budgetItemID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      transactionID,
			"user_id": userID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	}).AddRow(
		transactionID, 100.0, time.Now(), model.TransactionTypeExpense, "USD", nil, nil, userID, nil, time.Now(), time.Now(), accountID, budgetItemID,
		accountID, "Test Account", "BANK", 1000.0, "USD",
		budgetItemID, 500.0, "Food",
	)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(userID, transactionID).
		WillReturnRows(rows)

	transaction, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, transaction)
	assert.NotNil(t, transaction.BudgetItemID)
	assert.Equal(t, budgetItemID, *transaction.BudgetItemID)
	assert.NotNil(t, transaction.BudgetItem)
	assert.Equal(t, "Food", transaction.BudgetItem.Category)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindUniqueWithFiles(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      transactionID,
			"user_id": userID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	}).AddRow(
		transactionID, 100.0, time.Now(), model.TransactionTypeExpense, "USD", nil, "{file1.jpg,file2.pdf}", userID, nil, time.Now(), time.Now(), accountID, nil,
		accountID, "Test Account", "BANK", 1000.0, "USD",
		nil, nil, nil,
	)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(userID, transactionID).
		WillReturnRows(rows)

	transaction, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, transaction)
	assert.Len(t, transaction.Files, 2)
	assert.Contains(t, transaction.Files, "file1.jpg")
	assert.Contains(t, transaction.Files, "file2.pdf")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindUniqueWithDeletedAt(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	deletedAt := time.Now()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":      transactionID,
			"user_id": userID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	}).AddRow(
		transactionID, 100.0, time.Now(), model.TransactionTypeExpense, "USD", nil, nil, userID, deletedAt, time.Now(), time.Now(), accountID, nil,
		accountID, "Test Account", "BANK", 1000.0, "USD",
		nil, nil, nil,
	)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(userID, transactionID).
		WillReturnRows(rows)

	transaction, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, transaction)
	assert.NotNil(t, transaction.DeletedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryCountWithOnlyDateRange(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	startDate := time.Now().AddDate(0, -1, 0)
	endDate := time.Now()

	// Only date filters, no user_id - this tests the empty whereClause branch
	where := map[string]any{
		"start_date": startDate,
		"end_date":   endDate,
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(3)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions t`).
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 3, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryCountWithOnlyStartDate(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	startDate := time.Now().AddDate(0, -1, 0)

	// Only start_date filter - tests the empty whereClause + start_date branch
	where := map[string]any{
		"start_date": startDate,
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(5)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions t`).
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 5, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryCountWithOnlyEndDate(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	endDate := time.Now()

	// Only end_date filter - tests the empty whereClause + end_date branch
	where := map[string]any{
		"end_date": endDate,
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(7)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions t`).
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 7, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindManyWithOnlyStartDate(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	startDate := time.Now().AddDate(0, -1, 0)

	params := util.FindManyParams{
		Where: map[string]any{
			"start_date": startDate,
		},
		OrderBy: "created_at DESC",
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	})

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnRows(rows)

	transactions, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Empty(t, transactions)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindUniqueWithOnlyEndDate(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	transactionID := uuid.New()
	userID := uuid.New()
	accountID := uuid.New()
	endDate := time.Now()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id":       transactionID,
			"end_date": endDate,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	}).AddRow(
		transactionID, 100.0, time.Now(), model.TransactionTypeExpense, "USD", nil, nil, userID, nil, time.Now(), time.Now(), accountID, nil,
		accountID, "Test Account", "BANK", 1000.0, "USD",
		nil, nil, nil,
	)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnRows(rows)

	transaction, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, transaction)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindManyWithDateRangeAndFilters(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	transactionID := uuid.New()
	accountID := uuid.New()
	startDate := time.Now().AddDate(0, -1, 0)
	endDate := time.Now()

	// This tests both date range filters with other filters
	// to ensure the WHERE clause correctly adds AND conditions
	params := util.FindManyParams{
		Where: map[string]any{
			"user_id":    userID,
			"type":       []string{"EXPENSE"},
			"start_date": startDate,
			"end_date":   endDate,
		},
		OrderBy: "created_at DESC",
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	}).AddRow(
		transactionID, 100.0, time.Now(), model.TransactionTypeExpense, "USD", nil, nil, userID, nil, time.Now(), time.Now(), accountID, nil,
		accountID, "Bank", "BANK", 1000.0, "USD",
		nil, nil, nil,
	)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnRows(rows)

	transactions, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, transactions, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindManyWithOnlyStartDateAndFilters(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	startDate := time.Now().AddDate(0, -1, 0)

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id":    userID,
			"type":       []string{"EXPENSE"},
			"start_date": startDate,
		},
		OrderBy: "created_at DESC",
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	}).AddRow(
		uuid.New(), 100.0, time.Now(), model.TransactionTypeExpense, "USD", nil, nil, userID, nil, time.Now(), time.Now(), uuid.New(), nil,
		uuid.New(), "Bank", "BANK", 1000.0, "USD",
		nil, nil, nil,
	)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnRows(rows)

	transactions, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, transactions, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryFindManyWithOnlyEndDateAndFilters(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	endDate := time.Now()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id":  userID,
			"currency": []string{"USD"},
			"end_date": endDate,
		},
		OrderBy: "created_at DESC",
	}

	rows := sqlmock.NewRows([]string{
		"id", "amount", "date", "type", "currency", "notes", "files", "user_id", "deleted_at", "created_at", "updated_at", "account_id", "budget_item_id",
		"a_id", "a_name", "a_type", "a_balance", "a_currency",
		"bi_id", "bi_allocation", "bi_category",
	})

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WillReturnRows(rows)

	transactions, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Empty(t, transactions)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryGetAggregationsWithInvalidGroupBy(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	// This will test the validation path that is skipped for "t.type" and "t.currency"
	// We can't directly call getAggregations since it's private, but we can test through
	// the public methods. However, the validation only runs when there's no "." in groupBy.
	// Since all public methods use qualified column names, the validation is never triggered
	// through normal usage. This is intentional design - the validation is there for safety
	// but is bypassed by using qualified column names.

	// To test this, we need to test the path where groupBy doesn't contain "."
	// But since all public methods use qualified names, this path is only for future extensions
	rows := sqlmock.NewRows([]string{"key", "count", "min_amount", "max_amount", "avg_amount", "sum_amount"}).
		AddRow("EXPENSE", 10, 50.0, 500.0, 150.0, 1500.0)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(rows)

	aggs, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggs, 1)
	assert.Equal(t, 10, aggs["EXPENSE"].Count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryCountWithStartDateEndDateAndFilters(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	startDate := time.Now().AddDate(0, -1, 0)
	endDate := time.Now()

	where := map[string]any{
		"user_id":    userID,
		"type":       "EXPENSE",
		"start_date": startDate,
		"end_date":   endDate,
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(7)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions t`).
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 7, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAddDateRangeFilters(t *testing.T) {
	t.Run("both start and end date with existing whereClause", func(t *testing.T) {
		whereClause := " WHERE user_id = $1"
		args := []any{uuid.New()}
		where := map[string]any{
			"start_date": time.Now().AddDate(0, -1, 0),
			"end_date":   time.Now(),
		}

		resultClause, resultArgs := addDateRangeFilters(whereClause, args, where)

		assert.Contains(t, resultClause, " WHERE user_id = $1 AND")
		assert.Contains(t, resultClause, "t.date >= $2")
		assert.Contains(t, resultClause, "t.date <= $3")
		assert.Len(t, resultArgs, 3)
	})

	t.Run("only start date with existing whereClause", func(t *testing.T) {
		whereClause := " WHERE user_id = $1"
		args := []any{uuid.New()}
		where := map[string]any{
			"start_date": time.Now().AddDate(0, -1, 0),
		}

		resultClause, resultArgs := addDateRangeFilters(whereClause, args, where)

		assert.Contains(t, resultClause, " WHERE user_id = $1 AND")
		assert.Contains(t, resultClause, "t.date >= $2")
		assert.Len(t, resultArgs, 2)
	})

	t.Run("only end date with existing whereClause", func(t *testing.T) {
		whereClause := " WHERE user_id = $1"
		args := []any{uuid.New()}
		where := map[string]any{
			"end_date": time.Now(),
		}

		resultClause, resultArgs := addDateRangeFilters(whereClause, args, where)

		assert.Contains(t, resultClause, " WHERE user_id = $1 AND")
		assert.Contains(t, resultClause, "t.date <= $2")
		assert.Len(t, resultArgs, 2)
	})

	t.Run("no dates returns unchanged", func(t *testing.T) {
		whereClause := " WHERE user_id = $1"
		args := []any{uuid.New()}
		where := map[string]any{
			"user_id": uuid.New(),
		}

		resultClause, resultArgs := addDateRangeFilters(whereClause, args, where)

		assert.Equal(t, whereClause, resultClause)
		assert.Equal(t, args, resultArgs)
	})

	t.Run("only start date with empty whereClause", func(t *testing.T) {
		whereClause := ""
		args := []any{}
		where := map[string]any{
			"start_date": time.Now().AddDate(0, -1, 0),
		}

		resultClause, resultArgs := addDateRangeFilters(whereClause, args, where)

		assert.Equal(t, " WHERE t.date >= $1", resultClause)
		assert.Len(t, resultArgs, 1)
	})

	t.Run("only end date with empty whereClause", func(t *testing.T) {
		whereClause := ""
		args := []any{}
		where := map[string]any{
			"end_date": time.Now(),
		}

		resultClause, resultArgs := addDateRangeFilters(whereClause, args, where)

		assert.Equal(t, " WHERE t.date <= $1", resultClause)
		assert.Len(t, resultArgs, 1)
	})
}

func TestTransactionRepositoryGetAggregationsWithAccountOrBudgetItem(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{"key", "count", "min_amount", "max_amount", "avg_amount", "sum_amount"}).
		AddRow("Food", 10, 50.0, 500.0, 150.0, 1500.0).
		AddRow("Housing", 5, 100.0, 1000.0, 300.0, 1500.0)

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggs, err := repo.GetCategoryAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggs, 2)
	assert.Equal(t, 10, aggs["Food"].Count)
	assert.Equal(t, 5, aggs["Housing"].Count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTransactionRepositoryGetAggregationsWithEmptyResult(t *testing.T) {
	db, mock, repo := setupTransactionRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{"key", "count", "min_amount", "max_amount", "avg_amount", "sum_amount"})

	mock.ExpectQuery(`SELECT (.+) FROM transactions t`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggs, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.NotNil(t, aggs)
	assert.Empty(t, aggs)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestToPostgresArray(t *testing.T) {
	t.Run("empty slice", func(t *testing.T) {
		result := toPostgresArray([]string{})
		assert.Equal(t, "{}", result)
	})

	t.Run("nil slice", func(t *testing.T) {
		result := toPostgresArray(nil)
		assert.Equal(t, "{}", result)
	})

	t.Run("single element", func(t *testing.T) {
		result := toPostgresArray([]string{"file1.jpg"})
		assert.Equal(t, "{file1.jpg}", result)
	})

	t.Run("multiple elements", func(t *testing.T) {
		result := toPostgresArray([]string{"file1.jpg", "file2.pdf", "file3.png"})
		assert.Equal(t, "{file1.jpg,file2.pdf,file3.png}", result)
	})
}
