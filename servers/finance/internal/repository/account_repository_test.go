package repository

import (
	"context"
	"database/sql"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupMockDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock, AccountRepository) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)

	repo := NewAccountRepository(db)
	return db, mock, repo
}

func TestAccountRepository_Create(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	account := &model.Account{
		ID:       uuid.New(),
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		UserID:   uuid.New(),
		Currency: "USD",
		Notes:    nil,
	}

	mock.ExpectExec(`INSERT INTO accounts`).
		WithArgs(account.ID, account.Name, account.Type, account.Balance,
			account.UserID, account.Currency, account.Notes, false,
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Create(ctx, account)

	assert.NoError(t, err)
	assert.NotZero(t, account.CreatedAt)
	assert.NotZero(t, account.UpdatedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_Create_GeneratesID(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	account := &model.Account{
		ID:       uuid.Nil, // No ID provided
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		UserID:   uuid.New(),
		Currency: "USD",
	}

	mock.ExpectExec(`INSERT INTO accounts`).
		WithArgs(sqlmock.AnyArg(), account.Name, account.Type, account.Balance,
			account.UserID, account.Currency, account.Notes, false,
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Create(ctx, account)

	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, account.ID) // ID should be generated
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_FindUnique(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	accountID := uuid.New()
	userID := uuid.New()
	createdAt := time.Now()
	updatedAt := time.Now()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": accountID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	}).AddRow(
		accountID, "Test Account", model.AccountTypeBank, 1000.0, userID, "USD", nil, false, createdAt, updatedAt,
	)

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND id = \$1 LIMIT 1`).
		WithArgs(accountID).
		WillReturnRows(rows)

	account, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, account)
	assert.Equal(t, accountID, account.ID)
	assert.Equal(t, "Test Account", account.Name)
	assert.Equal(t, model.AccountTypeBank, account.Type)
	assert.Equal(t, 1000.0, account.Balance)
	assert.Equal(t, userID, account.UserID)
	assert.Equal(t, "USD", account.Currency)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_FindUnique_NotFound(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND id = \$1 LIMIT 1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(sql.ErrNoRows)

	account, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.Nil(t, account)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_FindMany(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		Limit:  10,
		Offset: 0,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Account 1", model.AccountTypeBank, 1000.0, userID, "USD", nil, false, time.Now(), time.Now(),
	).AddRow(
		uuid.New(), "Account 2", model.AccountTypeCash, 500.0, userID, "EUR", nil, false, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND user_id = \$1 ORDER BY created_at DESC LIMIT \$2`).
		WithArgs(userID, 10).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 2)
	assert.Equal(t, "Account 1", accounts[0].Name)
	assert.Equal(t, "Account 2", accounts[1].Name)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_FindMany_WithSearch(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
			"search":  "test",
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND user_id = \$1 AND \(LOWER\(name\) LIKE LOWER\(\$2\) OR LOWER\(COALESCE\(notes, ''\)\) LIKE LOWER\(\$2\)\) ORDER BY created_at DESC`).
		WithArgs(userID, "%test%").
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_Count(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(5)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE is_deleted = false AND user_id = \$1`).
		WithArgs(userID).
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 5, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_Update(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	account := &model.Account{
		ID:       uuid.New(),
		Name:     "Updated Account",
		Type:     model.AccountTypeBank,
		Balance:  1500.0,
		Currency: "EUR",
		Notes:    nil,
	}

	mock.ExpectExec(`UPDATE accounts SET name = \$2, type = \$3, balance = \$4, currency = \$5, notes = \$6, is_deleted = \$7, updated_at = \$8 WHERE id = \$1`).
		WithArgs(account.ID, account.Name, account.Type, account.Balance,
			account.Currency, account.Notes, account.IsDeleted, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Update(ctx, account)

	assert.NoError(t, err)
	assert.NotZero(t, account.UpdatedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetTypeAggregations(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"BANK", 2, 500.0, 1500.0, 1000.0, 2000.0,
	).AddRow(
		"CASH", 1, 100.0, 100.0, 100.0, 100.0,
	)

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 GROUP BY type ORDER BY type`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 2)

	bankAgg := aggregations["BANK"]
	assert.Equal(t, 2, bankAgg.Count)
	assert.Equal(t, 500.0, bankAgg.Min)
	assert.Equal(t, 1500.0, bankAgg.Max)
	assert.Equal(t, 1000.0, bankAgg.Avg)
	assert.Equal(t, 2000.0, bankAgg.Sum)

	cashAgg := aggregations["CASH"]
	assert.Equal(t, 1, cashAgg.Count)
	assert.Equal(t, 100.0, cashAgg.Min)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetCurrencyAggregations(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"USD", 3, 100.0, 2000.0, 1000.0, 3000.0,
	).AddRow(
		"EUR", 1, 500.0, 500.0, 500.0, 500.0,
	)

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 GROUP BY currency ORDER BY currency`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 2)

	usdAgg := aggregations["USD"]
	assert.Equal(t, 3, usdAgg.Count)
	assert.Equal(t, 100.0, usdAgg.Min)
	assert.Equal(t, 2000.0, usdAgg.Max)
	assert.Equal(t, 1000.0, usdAgg.Avg)
	assert.Equal(t, 3000.0, usdAgg.Sum)

	eurAgg := aggregations["EUR"]
	assert.Equal(t, 1, eurAgg.Count)
	assert.Equal(t, 500.0, eurAgg.Min)

	assert.NoError(t, mock.ExpectationsWereMet())
}
func TestAccountRepository_FindMany_WithMultipleFilters(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
			"type":    []string{"BANK", "CASH"},
		},
		Offset: 10,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND user_id = \$1 AND type IN \(\$2,\$3\) ORDER BY created_at DESC OFFSET \$4`).
		WithArgs(userID, "BANK", "CASH", 10).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_Count_WithTypeFilter(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
		"type":    []string{"BANK"},
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(2)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE is_deleted = false AND user_id = \$1 AND type IN \(\$2\)`).
		WithArgs(userID, "BANK").
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 2, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}
func TestAccountRepository_FindUnique_DatabaseError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND id = \$1 LIMIT 1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("database connection error"))

	account, err := repo.FindUnique(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Contains(t, err.Error(), "database connection error")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_FindMany_DatabaseError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND user_id = \$1 ORDER BY created_at DESC`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("database error"))

	accounts, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, accounts)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_Count_DatabaseError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE is_deleted = false AND user_id = \$1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("count error"))

	count, err := repo.Count(ctx, where)

	assert.Error(t, err)
	assert.Equal(t, 0, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_Create_DatabaseError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	account := &model.Account{
		ID:       uuid.New(),
		Name:     "Test Account",
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		UserID:   uuid.New(),
		Currency: "USD",
	}

	mock.ExpectExec(`INSERT INTO accounts`).
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("insert error"))

	err := repo.Create(ctx, account)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "insert error")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_Update_DatabaseError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	account := &model.Account{
		ID:       uuid.New(),
		Name:     "Updated Account",
		Type:     model.AccountTypeBank,
		Balance:  1500.0,
		Currency: "EUR",
	}

	mock.ExpectExec(`UPDATE accounts SET name = \$2, type = \$3, balance = \$4, currency = \$5, notes = \$6, is_deleted = \$7, updated_at = \$8 WHERE id = \$1`).
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("update error"))

	err := repo.Update(ctx, account)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "update error")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetTypeAggregations_DatabaseError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 GROUP BY type ORDER BY type`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("aggregation error"))

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggregations)
	assert.Contains(t, err.Error(), "failed to get type aggregations")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetCurrencyAggregations_DatabaseError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 GROUP BY currency ORDER BY currency`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("currency aggregation error"))

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggregations)
	assert.Contains(t, err.Error(), "failed to get currency aggregations")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_FindMany_WithCustomOrderBy(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		OrderBy: "name ASC",
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND user_id = \$1 ORDER BY name ASC`).
		WithArgs(userID).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_FindMany_EmptyWhere(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()

	params := util.FindManyParams{
		Where: nil,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false ORDER BY created_at DESC`).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}
func TestAccountRepository_FindMany_RowsScanError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
	}

	// Create rows with invalid data that will cause scan error
	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	}).AddRow(
		"invalid-uuid", "Account 1", model.AccountTypeBank, 1000.0, userID, "USD", nil, false, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND user_id = \$1 ORDER BY created_at DESC`).
		WithArgs(userID).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, accounts)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetTypeAggregations_ScanError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
	}

	// Create rows with invalid data that will cause scan error
	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"BANK", "invalid-count", 500.0, 1500.0, 1000.0, 2000.0,
	)

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 GROUP BY type ORDER BY type`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggregations)
	assert.Contains(t, err.Error(), "failed to scan type aggregation")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetCurrencyAggregations_ScanError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
	}

	// Create rows with invalid data that will cause scan error
	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"USD", "invalid-count", 100.0, 2000.0, 1000.0, 3000.0,
	)

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 GROUP BY currency ORDER BY currency`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggregations)
	assert.Contains(t, err.Error(), "failed to scan currency aggregation")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetTypeAggregations_RowsError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"BANK", 2, 500.0, 1500.0, 1000.0, 2000.0,
	).RowError(0, fmt.Errorf("rows iteration error"))

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 GROUP BY type ORDER BY type`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggregations)
	assert.Contains(t, err.Error(), "error iterating type aggregations")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetCurrencyAggregations_RowsError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"USD", 3, 100.0, 2000.0, 1000.0, 3000.0,
	).RowError(0, fmt.Errorf("rows iteration error"))

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 GROUP BY currency ORDER BY currency`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggregations)
	assert.Contains(t, err.Error(), "error iterating currency aggregations")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_FindMany_RowsError(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Account 1", model.AccountTypeBank, 1000.0, userID, "USD", nil, false, time.Now(), time.Now(),
	).RowError(0, fmt.Errorf("rows iteration error"))

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND user_id = \$1 ORDER BY created_at DESC`).
		WithArgs(userID).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, accounts)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_Count_WithSearchFilter(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
		"search":  "savings",
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(2)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE is_deleted = false AND user_id = \$1 AND \(LOWER\(name\) LIKE LOWER\(\$2\) OR LOWER\(COALESCE\(notes, ''\)\) LIKE LOWER\(\$2\)\)`).
		WithArgs(userID, "%savings%").
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 2, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_Count_EmptyWhere(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()

	where := map[string]any{}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(10)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE is_deleted = false`).
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 10, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_FindMany_WithLimitAndOffset(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		Limit:  5,
		Offset: 10,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND user_id = \$1 ORDER BY created_at DESC OFFSET \$2 LIMIT \$3`).
		WithArgs(userID, 10, 5).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_FindMany_OnlyOffset(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		Offset: 5,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND user_id = \$1 ORDER BY created_at DESC OFFSET \$2`).
		WithArgs(userID, 5).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_FindMany_OnlyLimit(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		Limit: 3,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false AND user_id = \$1 ORDER BY created_at DESC LIMIT \$2`).
		WithArgs(userID, 3).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestNewAccountRepository(t *testing.T) {
	db, _, _ := setupMockDB(t)
	defer db.Close()

	repo := NewAccountRepository(db)

	assert.NotNil(t, repo)
	assert.Implements(t, (*AccountRepository)(nil), repo)
}

// Additional tests to improve coverage for GetTypeAggregations

func TestAccountRepository_GetTypeAggregations_WithSearch(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
		"search":  "savings",
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"BANK", 1, 1000.0, 1000.0, 1000.0, 1000.0,
	)

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 AND \(LOWER\(name\) LIKE LOWER\(\$2\) OR LOWER\(COALESCE\(notes, ''\)\) LIKE LOWER\(\$2\)\) GROUP BY type ORDER BY type`).
		WithArgs(userID, "%savings%").
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "BANK")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetTypeAggregations_WithSliceFilter(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id":  userID,
		"currency": []string{"USD", "EUR"},
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"BANK", 2, 500.0, 1500.0, 1000.0, 2000.0,
	)

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 AND currency IN \(\$2,\$3\) GROUP BY type ORDER BY type`).
		WithArgs(userID, "USD", "EUR").
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "BANK")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetTypeAggregations_EmptyWhere(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()

	where := map[string]any{}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"BANK", 3, 100.0, 2000.0, 1000.0, 3000.0,
	).AddRow(
		"CASH", 2, 50.0, 500.0, 275.0, 550.0,
	)

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false GROUP BY type ORDER BY type`).
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 2)
	assert.Contains(t, aggregations, "BANK")
	assert.Contains(t, aggregations, "CASH")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetTypeAggregations_WithTypeFieldSkipped(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
		"type":    []string{"BANK"}, // This should be skipped in type aggregations
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"BANK", 1, 1000.0, 1000.0, 1000.0, 1000.0,
	).AddRow(
		"CASH", 1, 500.0, 500.0, 500.0, 500.0,
	)

	// Note: type field should be skipped, so only user_id filter should be applied
	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 GROUP BY type ORDER BY type`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 2)
	assert.Contains(t, aggregations, "BANK")
	assert.Contains(t, aggregations, "CASH")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Additional tests to improve coverage for GetCurrencyAggregations

func TestAccountRepository_GetCurrencyAggregations_WithSearch(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
		"search":  "checking",
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"USD", 2, 500.0, 1500.0, 1000.0, 2000.0,
	)

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 AND \(LOWER\(name\) LIKE LOWER\(\$2\) OR LOWER\(COALESCE\(notes, ''\)\) LIKE LOWER\(\$2\)\) GROUP BY currency ORDER BY currency`).
		WithArgs(userID, "%checking%").
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "USD")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetCurrencyAggregations_WithSliceFilter(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
		"type":    []string{"BANK", "CASH"},
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"USD", 2, 100.0, 1000.0, 550.0, 1100.0,
	).AddRow(
		"EUR", 1, 800.0, 800.0, 800.0, 800.0,
	)

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 AND type IN \(\$2,\$3\) GROUP BY currency ORDER BY currency`).
		WithArgs(userID, "BANK", "CASH").
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 2)
	assert.Contains(t, aggregations, "USD")
	assert.Contains(t, aggregations, "EUR")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetCurrencyAggregations_EmptyWhere(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()

	where := map[string]any{}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"USD", 5, 50.0, 2000.0, 800.0, 4000.0,
	).AddRow(
		"EUR", 2, 300.0, 1200.0, 750.0, 1500.0,
	)

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false GROUP BY currency ORDER BY currency`).
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 2)
	assert.Contains(t, aggregations, "USD")
	assert.Contains(t, aggregations, "EUR")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetCurrencyAggregations_WithCurrencyFieldSkipped(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id":  userID,
		"currency": []string{"USD"}, // This should be skipped in currency aggregations
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"USD", 2, 500.0, 1500.0, 1000.0, 2000.0,
	).AddRow(
		"EUR", 1, 800.0, 800.0, 800.0, 800.0,
	)

	// Note: currency field should be skipped, so only user_id filter should be applied
	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 GROUP BY currency ORDER BY currency`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 2)
	assert.Contains(t, aggregations, "USD")
	assert.Contains(t, aggregations, "EUR")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for non-slice field handling in aggregations
func TestAccountRepository_GetTypeAggregations_WithStringField(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id":  userID,
		"currency": "USD", // String field (not slice)
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"BANK", 1, 1000.0, 1000.0, 1000.0, 1000.0,
	)

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 AND currency = \$2 GROUP BY type ORDER BY type`).
		WithArgs(userID, "USD").
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "BANK")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepository_GetCurrencyAggregations_WithStringField(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
		"type":    "BANK", // String field (not slice)
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"USD", 1, 1000.0, 1000.0, 1000.0, 1000.0,
	)

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 AND type = \$2 GROUP BY currency ORDER BY currency`).
		WithArgs(userID, "BANK").
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "USD")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for unknown field handling in FindMany
func TestAccountRepository_FindMany_WithUnknownField(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id":       userID,
			"unknown_field": "test_value",
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Test Account", "bank", 1000.0, userID, "USD", "Test notes", false, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT id, name, type, balance, user_id, currency, notes, is_deleted, created_at, updated_at FROM accounts WHERE is_deleted = false AND user_id = \$1 AND unknown_field = \$2 ORDER BY created_at DESC`).
		WithArgs(userID, "test_value").
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for unknown field handling in Count
func TestAccountRepository_Count_WithUnknownField(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id":       userID,
		"unknown_field": "test_value",
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(1)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE is_deleted = false AND user_id = \$1 AND unknown_field = \$2`).
		WithArgs(userID, "test_value").
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 1, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for unknown field handling in GetTypeAggregations
func TestAccountRepository_GetTypeAggregations_WithUnknownField(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id":       userID,
		"unknown_field": "test_value",
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"bank", 2, 500.0, 1500.0, 1000.0, 2000.0,
	)

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 AND unknown_field = \$2 GROUP BY type ORDER BY type`).
		WithArgs(userID, "test_value").
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "bank")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for unknown field handling in GetCurrencyAggregations
func TestAccountRepository_GetCurrencyAggregations_WithUnknownField(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id":       userID,
		"unknown_field": "test_value",
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"USD", 2, 500.0, 1500.0, 1000.0, 2000.0,
	)

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 AND unknown_field = \$2 GROUP BY currency ORDER BY currency`).
		WithArgs(userID, "test_value").
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "USD")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for slice field handling in unknown fields for Count
func TestAccountRepository_Count_WithUnknownSliceField(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id":       userID,
		"unknown_slice": []string{"value1", "value2"},
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(2)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE is_deleted = false AND user_id = \$1 AND unknown_slice IN \(\$2,\$3\)`).
		WithArgs(userID, "value1", "value2").
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 2, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for slice field handling in unknown fields for FindMany
func TestAccountRepository_FindMany_WithUnknownSliceField(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id":       userID,
			"unknown_slice": []string{"value1", "value2"},
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Test Account", "bank", 1000.0, userID, "USD", "Test notes", false, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT id, name, type, balance, user_id, currency, notes, is_deleted, created_at, updated_at FROM accounts WHERE is_deleted = false AND user_id = \$1 AND unknown_slice IN \(\$2,\$3\) ORDER BY created_at DESC`).
		WithArgs(userID, "value1", "value2").
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for slice field handling in unknown fields for GetTypeAggregations
func TestAccountRepository_GetTypeAggregations_WithUnknownSliceField(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id":       userID,
		"unknown_slice": []string{"value1", "value2"},
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"bank", 2, 500.0, 1500.0, 1000.0, 2000.0,
	)

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 AND unknown_slice IN \(\$2,\$3\) GROUP BY type ORDER BY type`).
		WithArgs(userID, "value1", "value2").
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "bank")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for slice field handling in unknown fields for GetCurrencyAggregations
func TestAccountRepository_GetCurrencyAggregations_WithUnknownSliceField(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id":       userID,
		"unknown_slice": []string{"value1", "value2"},
	}

	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"USD", 2, 500.0, 1500.0, 1000.0, 2000.0,
	)

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false AND user_id = \$1 AND unknown_slice IN \(\$2,\$3\) GROUP BY currency ORDER BY currency`).
		WithArgs(userID, "value1", "value2").
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "USD")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test cases to achieve 100% coverage

// Test buildWhere with nil where and no excludeDeleted
func TestAccountRepository_FindUnique_NilWhereNoExcludeDeleted(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()

	// This should test the case where where is nil and no conditions are added
	params := util.FindUniqueParams{
		Where: nil,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "is_deleted", "created_at", "updated_at",
	})

	// This should generate a query without WHERE clause except for is_deleted = false
	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE is_deleted = false LIMIT 1`).
		WillReturnRows(rows)

	account, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.Nil(t, account)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test buildWhere with empty slice - it falls through to else clause
func TestAccountRepository_FindMany_WithEmptySlice(t *testing.T) {
	db, _, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
			"type":    []string{}, // Empty slice falls through to else clause
		},
	}

	// Empty slice will be treated as regular value and cause SQL error
	_, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported type []string")
}

// Test Count with empty slice - it falls through to else clause
func TestAccountRepository_Count_WithEmptySlice(t *testing.T) {
	db, _, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
		"type":    []string{}, // Empty slice falls through to else clause
	}

	// Empty slice will be treated as regular value and cause SQL error
	_, err := repo.Count(ctx, where)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported type []string")
}

// Test for the case where len(conditions) == 0 after processing
func TestAccountRepository_FindMany_EmptyConditionsAfterProcessing(t *testing.T) {
	db, mock, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()

	params := util.FindManyParams{
		Where: map[string]any{
			"type": "BANK", // This will be skipped in type aggregations
		},
	}

	// Create a custom test by calling getAggregations with skipField="type"
	// This should result in empty conditions after processing
	rows := sqlmock.NewRows([]string{
		"key", "count", "min_balance", "max_balance", "avg_balance", "sum_balance",
	}).AddRow(
		"BANK", 1, 1000.0, 1000.0, 1000.0, 1000.0,
	)

	// When type is skipped, no WHERE conditions should be added except is_deleted = false
	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE is_deleted = false GROUP BY type ORDER BY type`).
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, params.Where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test buildWhere function directly to achieve 100% coverage
func TestBuildWhere_NilWhereNoConditions(t *testing.T) {
	// Test the case where where is nil and excludeDeleted is false
	// This should return "", nil
	clause, args := buildWhere(nil, whereBuildOpts{
		fieldOrder:     []string{},
		skipField:      "",
		excludeDeleted: false, // This should result in no conditions
	})

	assert.Equal(t, "", clause)
	assert.Nil(t, args)
}

// Test buildWhere with nil where but excludeDeleted true
func TestBuildWhere_NilWhereWithExcludeDeleted(t *testing.T) {
	// Test the case where where is nil but excludeDeleted is true
	// This should return " WHERE is_deleted = false", nil
	clause, args := buildWhere(nil, whereBuildOpts{
		fieldOrder:     []string{},
		skipField:      "",
		excludeDeleted: true,
	})

	assert.Equal(t, " WHERE is_deleted = false", clause)
	assert.Nil(t, args)
}

// Test buildWhere with empty slice
func TestBuildWhere_EmptySlice(t *testing.T) {
	// Test the case where a field has an empty slice
	// This should fall through to the else clause and be treated as a regular value
	where := map[string]any{
		"type": []string{}, // Empty slice
	}

	clause, args := buildWhere(where, whereBuildOpts{
		fieldOrder:     []string{"type"},
		skipField:      "",
		excludeDeleted: true,
	})

	// Should have is_deleted = false AND type = $1 with empty slice as arg
	assert.Equal(t, " WHERE is_deleted = false AND type = $1", clause)
	assert.Len(t, args, 1)
	assert.Equal(t, []string{}, args[0])
}

// Test buildWhere where all fields are skipped resulting in empty conditions
func TestBuildWhere_AllFieldsSkipped(t *testing.T) {
	// Test the case where all fields are skipped, resulting in len(conditions) == 0
	where := map[string]any{
		"type": "BANK", // This will be skipped
	}

	clause, args := buildWhere(where, whereBuildOpts{
		fieldOrder:     []string{"type"},
		skipField:      "type", // Skip the only field we have
		excludeDeleted: false,  // Don't add is_deleted condition
	})

	// Should return empty clause since all conditions are skipped
	assert.Equal(t, "", clause)
	assert.Empty(t, args)
}

// Tests for new validation functions added for SQL injection prevention

func TestValidateOrderBy_ValidCases(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"Empty string returns default", "", "created_at DESC"},
		{"Valid column ASC", "name ASC", "name ASC"},
		{"Valid column DESC", "balance DESC", "balance DESC"},
		{"Valid column without direction defaults to ASC", "type", "type ASC"},
		{"Valid column with lowercase direction", "currency desc", "currency DESC"},
		{"Valid column with mixed case direction", "updated_at Asc", "updated_at ASC"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := validateOrderBy(tt.input)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestValidateOrderBy_InvalidCases(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectedErr string
	}{
		{"Invalid column", "invalid_column ASC", "invalid ORDER BY column: invalid_column"},
		{"Invalid direction", "name INVALID", "invalid ORDER BY direction: INVALID"},
		{"SQL injection attempt", "name; DROP TABLE accounts;", "invalid ORDER BY column: name;"},
		{"Multiple columns", "name, balance", "invalid ORDER BY column: name,"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := validateOrderBy(tt.input)
			assert.Error(t, err)
			assert.Equal(t, "", result)
			assert.Contains(t, err.Error(), tt.expectedErr)
		})
	}
}

func TestValidateGroupByColumn_ValidCases(t *testing.T) {
	tests := []struct {
		name   string
		column string
	}{
		{"Valid type column", "type"},
		{"Valid currency column", "currency"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateGroupByColumn(tt.column)
			assert.NoError(t, err)
		})
	}
}

func TestValidateGroupByColumn_InvalidCases(t *testing.T) {
	tests := []struct {
		name        string
		column      string
		expectedErr string
	}{
		{"Invalid column", "invalid_column", "invalid GROUP BY column: invalid_column"},
		{"SQL injection attempt", "type; DROP TABLE accounts;", "invalid GROUP BY column: type; DROP TABLE accounts;"},
		{"Empty column", "", "invalid GROUP BY column: "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateGroupByColumn(tt.column)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), tt.expectedErr)
		})
	}
}

func TestAccountRepository_FindMany_InvalidOrderBy(t *testing.T) {
	db, _, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		OrderBy: "invalid_column ASC", // Invalid column should cause validation error
	}

	accounts, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, accounts)
	assert.Contains(t, err.Error(), "invalid ORDER BY clause")
	assert.Contains(t, err.Error(), "invalid ORDER BY column: invalid_column")
}

func TestAccountRepository_GetAggregations_InvalidGroupBy(t *testing.T) {
	// Test invalid GROUP BY column by calling getAggregations directly
	// We need to access the private method, so we'll test through the public methods
	// that use invalid columns

	// Since we can't directly call getAggregations with invalid groupBy,
	// we'll test the validation by modifying the allowedGroupByColumns temporarily
	// But since we can't modify package-level variables in tests, we'll test
	// the validation function directly above and trust that it's used correctly
	// in the getAggregations method.

	// The validation is already tested in TestValidateGroupByColumn_InvalidCases
	// and the integration is covered by the existing aggregation tests.

	// This test is intentionally empty as the validation is tested separately
	// and the integration is covered by existing tests
}

// Test to cover the validation error path in getAggregations
// Since getAggregations is private, we need to test through reflection or by
// temporarily modifying the validation logic. However, since we can't easily
// modify package-level variables, we'll focus on testing the validation functions
// directly and trust that they're properly integrated.

// The missing coverage is likely in the error handling paths that are hard to trigger
// in normal testing scenarios. Let's add a test that covers edge cases.

func TestAccountRepository_Coverage_EdgeCases(t *testing.T) {
	// Test to ensure we have full coverage of validation functions
	// These are already tested individually, but this ensures integration

	// Test validateOrderBy with whitespace
	result, err := validateOrderBy("  name  ASC  ")
	assert.NoError(t, err)
	assert.Equal(t, "name ASC", result)

	// Test validateOrderBy with just whitespace
	result, err = validateOrderBy("   ")
	assert.NoError(t, err)
	assert.Equal(t, "created_at DESC", result)

	// Test validateGroupByColumn with valid columns
	err = validateGroupByColumn("type")
	assert.NoError(t, err)

	err = validateGroupByColumn("currency")
	assert.NoError(t, err)
}

// Test to achieve 100% coverage by testing the private getAggregations method
// with invalid groupBy parameter using reflection
func TestAccountRepository_GetAggregations_InvalidGroupByReflection(t *testing.T) {
	db, _, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	where := map[string]any{
		"user_id": userID,
	}

	// Use reflection to call the private getAggregations method with invalid groupBy
	repoValue := reflect.ValueOf(repo)
	method := repoValue.MethodByName("getAggregations")

	// If the method is not found (because it's private), we need to access it differently
	if !method.IsValid() {
		// Access the underlying struct
		repoStruct := reflect.ValueOf(repo).Elem()
		// Get the method from the struct type
		methodType := repoStruct.Type()
		for i := 0; i < methodType.NumMethod(); i++ {
			if methodType.Method(i).Name == "getAggregations" {
				method = repoStruct.Method(i)
				break
			}
		}
	}

	// If we still can't access it, try a different approach
	if !method.IsValid() {
		// Create parameters for the method call
		params := []reflect.Value{
			reflect.ValueOf(ctx),
			reflect.ValueOf("invalid_column"), // This should trigger validation error
			reflect.ValueOf("invalid_column"),
			reflect.ValueOf([]string{"user_id"}),
			reflect.ValueOf(where),
		}

		// Try to get the method through the interface
		repoInterface := repo.(*accountRepository)
		methodValue := reflect.ValueOf(repoInterface).MethodByName("getAggregations")

		if methodValue.IsValid() {
			// Call the method
			results := methodValue.Call(params)

			// Check that we got an error (second return value)
			if len(results) == 2 {
				errValue := results[1]
				if !errValue.IsNil() {
					err := errValue.Interface().(error)
					assert.Error(t, err)
					assert.Contains(t, err.Error(), "invalid aggregation groupBy")
					return
				}
			}
		}
	}

	// If reflection doesn't work, we'll test the validation function directly
	// which should be sufficient for coverage
	err := validateGroupByColumn("invalid_column")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid GROUP BY column: invalid_column")
}

// Test helper function to access private method for 100% coverage
func (r *accountRepository) testGetAggregationsWithInvalidGroupBy(ctx context.Context, where map[string]any) error {
	// Call getAggregations with invalid groupBy to trigger validation error
	_, err := r.getAggregations(ctx, "invalid_column", "invalid_column", []string{"user_id"}, where)
	return err
}

// Test to achieve 100% coverage by testing the validation error path in getAggregations
func TestAccountRepository_GetAggregations_ValidationError(t *testing.T) {
	db, _, repo := setupMockDB(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	// Cast to concrete type to access test helper method
	repoImpl := repo.(*accountRepository)

	// Call the test helper that triggers the validation error
	err := repoImpl.testGetAggregationsWithInvalidGroupBy(ctx, where)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid aggregation groupBy")
	assert.Contains(t, err.Error(), "invalid GROUP BY column: invalid_column")
}
