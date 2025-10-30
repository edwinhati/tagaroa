package repository

import (
	"context"
	"database/sql"
	"fmt"
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
