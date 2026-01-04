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
	defaultAccountRepoAccountName = "Account 1"
	defaultAccountRepoTestName    = "Test Account"
	orderByNameASC                = "name ASC"
	invalidGroupByColumnErr       = "invalid GROUP BY column: invalid_column"
	rowsIterationErrorText        = "rows iteration error"
)

func setupAccountRepository(t *testing.T) (*sql.DB, sqlmock.Sqlmock, AccountRepository) {
	db, mock := client.SetupMockDB(t)
	repo := NewAccountRepository(db)
	return db, mock, repo
}

func TestAccountRepositoryCreate(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	account := &model.Account{
		ID:       uuid.New(),
		Name:     defaultAccountRepoTestName,
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		UserID:   uuid.New(),
		Currency: "USD",
		Notes:    nil,
	}

	mock.ExpectExec(`INSERT INTO accounts`).
		WithArgs(account.ID, account.Name, account.Type, account.Balance,
			account.UserID, account.Currency, account.Notes, nil,
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Create(ctx, account)

	assert.NoError(t, err)
	assert.NotZero(t, account.CreatedAt)
	assert.NotZero(t, account.UpdatedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryCreateGeneratesID(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	account := &model.Account{
		ID:       uuid.Nil, // No ID provided
		Name:     defaultAccountRepoTestName,
		Type:     model.AccountTypeBank,
		Balance:  1000.0,
		UserID:   uuid.New(),
		Currency: "USD",
	}

	mock.ExpectExec(`INSERT INTO accounts`).
		WithArgs(sqlmock.AnyArg(), account.Name, account.Type, account.Balance,
			account.UserID, account.Currency, account.Notes, nil,
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Create(ctx, account)

	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, account.ID) // ID should be generated
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryFindUnique(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		accountID, defaultAccountRepoTestName, model.AccountTypeBank, 1000.0, userID, "USD", nil, nil, createdAt, updatedAt,
	)

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND id = \$1 LIMIT 1`).
		WithArgs(accountID).
		WillReturnRows(rows)

	account, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, account)
	assert.Equal(t, accountID, account.ID)
	assert.Equal(t, defaultAccountRepoTestName, account.Name)
	assert.Equal(t, model.AccountTypeBank, account.Type)
	assert.Equal(t, 1000.0, account.Balance)
	assert.Equal(t, userID, account.UserID)
	assert.Equal(t, "USD", account.Currency)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryFindUniqueNotFound(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND id = \$1 LIMIT 1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(sql.ErrNoRows)

	account, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.Nil(t, account)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryFindMany(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), defaultAccountRepoAccountName, model.AccountTypeBank, 1000.0, userID, "USD", nil, nil, time.Now(), time.Now(),
	).AddRow(
		uuid.New(), "Account 2", model.AccountTypeCash, 500.0, userID, "EUR", nil, nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC LIMIT \$2`).
		WithArgs(userID, 10).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 2)
	assert.Equal(t, defaultAccountRepoAccountName, accounts[0].Name)
	assert.Equal(t, "Account 2", accounts[1].Name)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryFindManyWithSearch(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND \(LOWER.+\) ORDER BY created_at DESC`).
		WithArgs(userID, "%test%").
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryCount(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(5)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1`).
		WithArgs(userID).
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 5, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryUpdate(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectExec(`UPDATE accounts SET name = \$2, type = \$3, balance = \$4, currency = \$5, notes = \$6, deleted_at = \$7, updated_at = \$8 WHERE id = \$1`).
		WithArgs(account.ID, account.Name, account.Type, account.Balance,
			account.Currency, account.Notes, account.DeletedAt, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Update(ctx, account)

	assert.NoError(t, err)
	assert.NotZero(t, account.UpdatedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetTypeAggregations(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 GROUP BY type ORDER BY type`).
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

func TestAccountRepositoryGetCurrencyAggregations(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 GROUP BY currency ORDER BY currency`).
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
func TestAccountRepositoryFindManyWithMultipleFilters(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND type IN \(\$2,\$3\) ORDER BY created_at DESC OFFSET \$4`).
		WithArgs(userID, "BANK", "CASH", 10).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryCountWithTypeFilter(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
		"type":    []string{"BANK"},
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(2)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND type IN \(\$2\)`).
		WithArgs(userID, "BANK").
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 2, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}
func TestAccountRepositoryFindUniqueDatabaseError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND id = \$1 LIMIT 1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("database connection error"))

	account, err := repo.FindUnique(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, account)
	assert.Contains(t, err.Error(), "database connection error")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryFindManyDatabaseError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("database error"))

	accounts, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, accounts)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryCountDatabaseError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("count error"))

	count, err := repo.Count(ctx, where)

	assert.Error(t, err)
	assert.Equal(t, 0, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryCreateDatabaseError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	account := &model.Account{
		ID:       uuid.New(),
		Name:     defaultAccountRepoTestName,
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

func TestAccountRepositoryUpdateDatabaseError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	account := &model.Account{
		ID:       uuid.New(),
		Name:     "Updated Account",
		Type:     model.AccountTypeBank,
		Balance:  1500.0,
		Currency: "EUR",
	}

	mock.ExpectExec(`UPDATE accounts SET name = \$2, type = \$3, balance = \$4, currency = \$5, notes = \$6, deleted_at = \$7, updated_at = \$8 WHERE id = \$1`).
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("update error"))

	err := repo.Update(ctx, account)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "update error")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetTypeAggregationsDatabaseError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 GROUP BY type ORDER BY type`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("aggregation error"))

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggregations)
	assert.Contains(t, err.Error(), "failed to get type aggregations")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetCurrencyAggregationsDatabaseError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 GROUP BY currency ORDER BY currency`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("currency aggregation error"))

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggregations)
	assert.Contains(t, err.Error(), "failed to get currency aggregations")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryFindManyWithCustomOrderBy(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		OrderBy: orderByNameASC,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY name ASC`).
		WithArgs(userID).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryFindManyEmptyWhere(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()

	params := util.FindManyParams{
		Where: nil,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL ORDER BY created_at DESC`).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}
func TestAccountRepositoryFindManyRowsScanError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		"invalid-uuid", defaultAccountRepoAccountName, model.AccountTypeBank, 1000.0, userID, "USD", nil, nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC`).
		WithArgs(userID).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, accounts)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetTypeAggregationsScanError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 GROUP BY type ORDER BY type`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggregations)
	assert.Contains(t, err.Error(), "failed to scan type aggregation")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetCurrencyAggregationsScanError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 GROUP BY currency ORDER BY currency`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggregations)
	assert.Contains(t, err.Error(), "failed to scan currency aggregation")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetTypeAggregationsRowsError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
	).RowError(0, fmt.Errorf(rowsIterationErrorText))

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 GROUP BY type ORDER BY type`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggregations)
	assert.Contains(t, err.Error(), "error iterating type aggregations")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetCurrencyAggregationsRowsError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
	).RowError(0, fmt.Errorf(rowsIterationErrorText))

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 GROUP BY currency ORDER BY currency`).
		WithArgs(userID).
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.Error(t, err)
	assert.Nil(t, aggregations)
	assert.Contains(t, err.Error(), "error iterating currency aggregations")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryFindManyRowsError(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), defaultAccountRepoAccountName, model.AccountTypeBank, 1000.0, userID, "USD", nil, nil, time.Now(), time.Now(),
	).RowError(0, fmt.Errorf(rowsIterationErrorText))

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC`).
		WithArgs(userID).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, accounts)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryCountWithSearchFilter(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
		"search":  "savings",
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(2)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND \(LOWER.+\)`).
		WithArgs(userID, "%savings%").
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 2, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryCountEmptyWhere(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()

	where := map[string]any{}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(10)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE deleted_at IS NULL`).
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 10, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryFindManyWithLimitAndOffset(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC OFFSET \$2 LIMIT \$3`).
		WithArgs(userID, 10, 5).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryFindManyOnlyOffset(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC OFFSET \$2`).
		WithArgs(userID, 5).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryFindManyOnlyLimit(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC LIMIT \$2`).
		WithArgs(userID, 3).
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestNewAccountRepository(t *testing.T) {
	db, _, _ := setupAccountRepository(t)
	defer db.Close()

	repo := NewAccountRepository(db)

	assert.NotNil(t, repo)
	assert.Implements(t, (*AccountRepository)(nil), repo)
}

// Additional tests to improve coverage for GetTypeAggregations

func TestAccountRepositoryGetTypeAggregationsWithSearch(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND \(LOWER.+\) GROUP BY type ORDER BY type`).
		WithArgs(userID, "%savings%").
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "BANK")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetTypeAggregationsWithSliceFilter(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND currency IN \(\$2,\$3\) GROUP BY type ORDER BY type`).
		WithArgs(userID, "USD", "EUR").
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "BANK")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetTypeAggregationsEmptyWhere(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL GROUP BY type ORDER BY type`).
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 2)
	assert.Contains(t, aggregations, "BANK")
	assert.Contains(t, aggregations, "CASH")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetTypeAggregationsWithTypeFieldSkipped(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 GROUP BY type ORDER BY type`).
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

func TestAccountRepositoryGetCurrencyAggregationsWithSearch(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND \(LOWER.+\) GROUP BY currency ORDER BY currency`).
		WithArgs(userID, "%checking%").
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "USD")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetCurrencyAggregationsWithSliceFilter(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND type IN \(\$2,\$3\) GROUP BY currency ORDER BY currency`).
		WithArgs(userID, "BANK", "CASH").
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 2)
	assert.Contains(t, aggregations, "USD")
	assert.Contains(t, aggregations, "EUR")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetCurrencyAggregationsEmptyWhere(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL GROUP BY currency ORDER BY currency`).
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 2)
	assert.Contains(t, aggregations, "USD")
	assert.Contains(t, aggregations, "EUR")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetCurrencyAggregationsWithCurrencyFieldSkipped(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 GROUP BY currency ORDER BY currency`).
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
func TestAccountRepositoryGetTypeAggregationsWithStringField(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND currency = \$2 GROUP BY type ORDER BY type`).
		WithArgs(userID, "USD").
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "BANK")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAccountRepositoryGetCurrencyAggregationsWithStringField(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND type = \$2 GROUP BY currency ORDER BY currency`).
		WithArgs(userID, "BANK").
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "USD")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for unknown field handling in FindMany
func TestAccountRepositoryFindManyWithUnknownField(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), defaultAccountRepoTestName, "bank", 1000.0, userID, "USD", "Test notes", nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT id, name, type, balance, user_id, currency, notes, deleted_at, created_at, updated_at FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND unknown_field = \$2 ORDER BY created_at DESC`).
		WithArgs(userID, "test_value").
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for unknown field handling in Count
func TestAccountRepositoryCountWithUnknownField(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id":       userID,
		"unknown_field": "test_value",
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(1)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND unknown_field = \$2`).
		WithArgs(userID, "test_value").
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 1, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for unknown field handling in GetTypeAggregations
func TestAccountRepositoryGetTypeAggregationsWithUnknownField(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND unknown_field = \$2 GROUP BY type ORDER BY type`).
		WithArgs(userID, "test_value").
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "bank")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for unknown field handling in GetCurrencyAggregations
func TestAccountRepositoryGetCurrencyAggregationsWithUnknownField(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND unknown_field = \$2 GROUP BY currency ORDER BY currency`).
		WithArgs(userID, "test_value").
		WillReturnRows(rows)

	aggregations, err := repo.GetCurrencyAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "USD")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for slice field handling in unknown fields for Count
func TestAccountRepositoryCountWithUnknownSliceField(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id":       userID,
		"unknown_slice": []string{"value1", "value2"},
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(2)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND unknown_slice IN \(\$2,\$3\)`).
		WithArgs(userID, "value1", "value2").
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 2, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for slice field handling in unknown fields for FindMany
func TestAccountRepositoryFindManyWithUnknownSliceField(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), defaultAccountRepoTestName, "bank", 1000.0, userID, "USD", "Test notes", nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT id, name, type, balance, user_id, currency, notes, deleted_at, created_at, updated_at FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND unknown_slice IN \(\$2,\$3\) ORDER BY created_at DESC`).
		WithArgs(userID, "value1", "value2").
		WillReturnRows(rows)

	accounts, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, accounts, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for slice field handling in unknown fields for GetTypeAggregations
func TestAccountRepositoryGetTypeAggregationsWithUnknownSliceField(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND unknown_slice IN \(\$2,\$3\) GROUP BY type ORDER BY type`).
		WithArgs(userID, "value1", "value2").
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.Contains(t, aggregations, "bank")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test for slice field handling in unknown fields for GetCurrencyAggregations
func TestAccountRepositoryGetCurrencyAggregationsWithUnknownSliceField(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	mock.ExpectQuery(`SELECT currency as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL AND user_id = \$1 AND unknown_slice IN \(\$2,\$3\) GROUP BY currency ORDER BY currency`).
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
func TestAccountRepositoryFindUniqueNilWhereNoExcludeDeleted(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()

	// This should test the case where where is nil and no conditions are added
	params := util.FindUniqueParams{
		Where: nil,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "balance", "user_id", "currency", "notes", "deleted_at", "created_at", "updated_at",
	})

	// This should generate a query without WHERE clause except for deleted_at IS NULL
	mock.ExpectQuery(`SELECT (.+) FROM accounts WHERE deleted_at IS NULL LIMIT 1`).
		WillReturnRows(rows)

	account, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.Nil(t, account)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test buildWhere with empty slice - it falls through to else clause
func TestAccountRepositoryFindManyWithEmptySlice(t *testing.T) {
	db, _, repo := setupAccountRepository(t)
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
func TestAccountRepositoryCountWithEmptySlice(t *testing.T) {
	db, _, repo := setupAccountRepository(t)
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
func TestAccountRepositoryFindManyEmptyConditionsAfterProcessing(t *testing.T) {
	db, mock, repo := setupAccountRepository(t)
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

	// When type is skipped, no WHERE conditions should be added except deleted_at IS NULL
	mock.ExpectQuery(`SELECT type as key, COUNT\(\*\) as count, COALESCE\(MIN\(balance\), 0\) as min_balance, COALESCE\(MAX\(balance\), 0\) as max_balance, COALESCE\(AVG\(balance\), 0\) as avg_balance, COALESCE\(SUM\(balance\), 0\) as sum_balance FROM accounts WHERE deleted_at IS NULL GROUP BY type ORDER BY type`).
		WillReturnRows(rows)

	aggregations, err := repo.GetTypeAggregations(ctx, params.Where)

	assert.NoError(t, err)
	assert.Len(t, aggregations, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// Test buildWhere function directly to achieve 100% coverage
func TestBuildWhereNilWhereNoConditions(t *testing.T) {
	// Test the case where where is nil and excludeDeleted is false
	// This should return "", nil
	clause, args := util.BuildWhere(nil, util.WhereBuildOpts{
		FieldOrder:     []string{},
		SkipField:      "",
		ExcludeDeleted: false, // This should result in no conditions
	})

	assert.Equal(t, "", clause)
	assert.Nil(t, args)
}

// Test buildWhere with nil where but excludeDeleted true
func TestBuildWhereNilWhereWithExcludeDeleted(t *testing.T) {
	// Test the case where where is nil but excludeDeleted is true
	// This should return " WHERE deleted_at IS NULL", nil
	clause, args := util.BuildWhere(nil, util.WhereBuildOpts{
		FieldOrder:     []string{},
		SkipField:      "",
		ExcludeDeleted: true,
	})

	assert.Equal(t, " WHERE deleted_at IS NULL", clause)
	assert.Nil(t, args)
}

// Test buildWhere with empty slice
func TestBuildWhereEmptySlice(t *testing.T) {
	// Test the case where a field has an empty slice
	// This should fall through to the else clause and be treated as a regular value
	where := map[string]any{
		"type": []string{}, // Empty slice
	}

	clause, args := util.BuildWhere(where, util.WhereBuildOpts{
		FieldOrder:     []string{"type"},
		SkipField:      "",
		ExcludeDeleted: true,
	})

	// Should have deleted_at IS NULL AND type = $1 with empty slice as arg
	assert.Equal(t, " WHERE deleted_at IS NULL AND type = $1", clause)
	assert.Len(t, args, 1)
	assert.Equal(t, []string{}, args[0])
}

func TestBuildWhereSliceCondition(t *testing.T) {
	where := map[string]any{
		"type": []string{"BANK", "CASH"},
	}

	clause, args := util.BuildWhere(where, util.WhereBuildOpts{
		FieldOrder:     []string{"type"},
		SkipField:      "",
		ExcludeDeleted: true,
	})

	assert.Equal(t, " WHERE deleted_at IS NULL AND type IN ($1,$2)", clause)
	assert.Equal(t, []any{"BANK", "CASH"}, args)
}

// Test buildWhere where all fields are skipped resulting in empty conditions
func TestBuildWhereAllFieldsSkipped(t *testing.T) {
	// Test the case where all fields are skipped, resulting in len(conditions) == 0
	where := map[string]any{
		"type": "BANK", // This will be skipped
	}

	clause, args := util.BuildWhere(where, util.WhereBuildOpts{
		FieldOrder:     []string{"type"},
		SkipField:      "type", // Skip the only field we have
		ExcludeDeleted: false,  // Don't add deleted_at condition
	})

	// Should return empty clause since all conditions are skipped
	assert.Equal(t, "", clause)
	assert.Empty(t, args)
}

type accountRowScanner struct {
	row []any
}

func (s accountRowScanner) Scan(dest ...any) error {
	if len(dest) != len(s.row) {
		return fmt.Errorf("mismatched lengths")
	}
	for i, d := range dest {
		switch target := d.(type) {
		case *uuid.UUID:
			*target = s.row[i].(uuid.UUID)
		case *string:
			*target = s.row[i].(string)
		case **string:
			if s.row[i] == nil {
				*target = nil
			} else {
				val := s.row[i].(string)
				*target = &val
			}
		case *model.AccountType:
			*target = s.row[i].(model.AccountType)
		case *float64:
			*target = s.row[i].(float64)
		case *sql.NullTime:
			*target = s.row[i].(sql.NullTime)
		case *time.Time:
			*target = s.row[i].(time.Time)
		default:
			return fmt.Errorf("unsupported type %T", d)
		}
	}
	return nil
}

func TestScanAccountSetsDeletedAt(t *testing.T) {
	now := time.Now()
	acc := accountRowScanner{row: []any{
		uuid.New(),
		defaultAccountRepoTestName,
		model.AccountTypeBank,
		100.0,
		uuid.New(),
		"USD",
		nil,
		sql.NullTime{Time: now, Valid: true},
		now,
		now,
	}}

	account, err := scanAccount(acc)
	assert.NoError(t, err)
	assert.NotNil(t, account.DeletedAt)
}

// Tests for new validation functions added for SQL injection prevention

func TestValidateOrderByValidCases(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"Empty string returns default", "", "created_at DESC"},
		{"Valid column ASC", orderByNameASC, orderByNameASC},
		{"Valid column DESC", "balance DESC", "balance DESC"},
		{"Valid column without direction defaults to ASC", "type", "type ASC"},
		{"Valid column with lowercase direction", "currency desc", "currency DESC"},
		{"Valid column with mixed case direction", "updated_at Asc", "updated_at ASC"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := util.ValidateOrderBy(tt.input, allowedOrderByColumns)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestValidateOrderByInvalidCases(t *testing.T) {
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
			result, err := util.ValidateOrderBy(tt.input, allowedOrderByColumns)
			assert.Error(t, err)
			assert.Equal(t, "", result)
			assert.Contains(t, err.Error(), tt.expectedErr)
		})
	}
}

func TestValidateGroupByColumnValidCases(t *testing.T) {
	tests := []struct {
		name   string
		column string
	}{
		{"Valid type column", "type"},
		{"Valid currency column", "currency"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := util.ValidateGroupByColumn(tt.column, allowedGroupByColumns)
			assert.NoError(t, err)
		})
	}
}

func TestValidateGroupByColumnInvalidCases(t *testing.T) {
	tests := []struct {
		name        string
		column      string
		expectedErr string
	}{
		{"Invalid column", "invalid_column", invalidGroupByColumnErr},
		{"SQL injection attempt", "type; DROP TABLE accounts;", "invalid GROUP BY column: type; DROP TABLE accounts;"},
		{"Empty column", "", "invalid GROUP BY column: "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := util.ValidateGroupByColumn(tt.column, allowedGroupByColumns)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), tt.expectedErr)
		})
	}
}

func TestAccountRepositoryFindManyInvalidOrderBy(t *testing.T) {
	db, _, repo := setupAccountRepository(t)
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

func TestAccountRepositoryGetAggregationsInvalidGroupBy(t *testing.T) {
	db, _, repo := setupAccountRepository(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	repoImpl := repo.(*accountRepository)
	_, err := repoImpl.getAggregations(ctx, "invalid_column", "invalid_column", []string{"user_id"}, where)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid aggregation groupBy")
	assert.Contains(t, err.Error(), invalidGroupByColumnErr)
}

func TestAccountRepositoryCoverageEdgeCases(t *testing.T) {
	// Test to ensure we have full coverage of validation functions
	// These are already tested individually, but this ensures integration

	// Test validateOrderBy with whitespace
	result, err := util.ValidateOrderBy("  name  ASC  ", allowedOrderByColumns)
	assert.NoError(t, err)
	assert.Equal(t, orderByNameASC, result)

	// Test validateOrderBy with just whitespace
	result, err = util.ValidateOrderBy("   ", allowedOrderByColumns)
	assert.NoError(t, err)
	assert.Equal(t, "created_at DESC", result)

	// Test validateGroupByColumn with valid columns
	err = util.ValidateGroupByColumn("type", allowedGroupByColumns)
	assert.NoError(t, err)

	err = util.ValidateGroupByColumn("currency", allowedGroupByColumns)
	assert.NoError(t, err)
}

// Test to ensure validation errors from getAggregations are surfaced with context.
