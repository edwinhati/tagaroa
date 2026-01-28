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

func setupLiabilityRepository(t *testing.T) (*sql.DB, sqlmock.Sqlmock, LiabilityRepository) {
	db, mock := client.SetupMockDB(t)
	repo := NewLiabilityRepository(db)
	return db, mock, repo
}

func TestLiabilityRepositoryCreate(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	liability := &model.Liability{
		ID:       uuid.New(),
		Name:     "Test Liability",
		Type:     model.LiabilityTypeLoan,
		Amount:   1000.0,
		UserID:   uuid.New(),
		Currency: "USD",
	}

	mock.ExpectExec(`INSERT INTO liabilities`).
		WithArgs(liability.ID, liability.Name, liability.Type, liability.Amount,
			liability.Currency, liability.UserID, liability.PaidAt, liability.Notes,
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Create(ctx, liability)

	assert.NoError(t, err)
	assert.NotZero(t, liability.CreatedAt)
	assert.NotZero(t, liability.UpdatedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryCreateGeneratesID(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	liability := &model.Liability{
		ID:       uuid.Nil,
		Name:     "Test Liability",
		Type:     model.LiabilityTypeMortgage,
		Amount:   250000.0,
		UserID:   uuid.New(),
		Currency: "USD",
	}

	mock.ExpectExec(`INSERT INTO liabilities`).
		WithArgs(sqlmock.AnyArg(), liability.Name, liability.Type, liability.Amount,
			liability.Currency, liability.UserID, liability.PaidAt, liability.Notes,
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Create(ctx, liability)

	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, liability.ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryFindUnique(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	liabilityID := uuid.New()
	userID := uuid.New()
	createdAt := time.Now()
	updatedAt := time.Now()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": liabilityID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "amount", "currency", "user_id", "paid_at", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		liabilityID, "Test Loan", model.LiabilityTypeLoan, 1000.0, "USD", userID, nil, nil, nil, createdAt, updatedAt,
	)

	mock.ExpectQuery(`SELECT (.+) FROM liabilities WHERE deleted_at IS NULL AND id = \$1 LIMIT 1`).
		WithArgs(liabilityID).
		WillReturnRows(rows)

	liability, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, liability)
	assert.Equal(t, liabilityID, liability.ID)
	assert.Equal(t, "Test Loan", liability.Name)
	assert.Equal(t, model.LiabilityTypeLoan, liability.Type)
	assert.Equal(t, 1000.0, liability.Amount)
	assert.Equal(t, userID, liability.UserID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryFindUniqueNotFound(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM liabilities WHERE deleted_at IS NULL AND id = \$1 LIMIT 1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(sql.ErrNoRows)

	liability, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.Nil(t, liability)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryFindMany(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
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
		"id", "name", "type", "amount", "currency", "user_id", "paid_at", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Loan 1", model.LiabilityTypeLoan, 1000.0, "USD", userID, nil, nil, nil, time.Now(), time.Now(),
	).AddRow(
		uuid.New(), "Credit Card", model.LiabilityTypeCreditCard, 500.0, "USD", userID, nil, nil, nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM liabilities WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC LIMIT \$2`).
		WithArgs(userID, 10).
		WillReturnRows(rows)

	liabilities, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, liabilities, 2)
	assert.Equal(t, "Loan 1", liabilities[0].Name)
	assert.Equal(t, "Credit Card", liabilities[1].Name)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryFindManyWithTypesFilter(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
			"type":    []string{"LOAN", "MORTGAGE"},
		},
		Limit:  10,
		Offset: 0,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "amount", "currency", "user_id", "paid_at", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Loan 1", model.LiabilityTypeLoan, 1000.0, "USD", userID, nil, nil, nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM liabilities WHERE deleted_at IS NULL AND user_id = \$1 AND type IN \(\$2,\$3\) ORDER BY created_at DESC LIMIT \$4`).
		WithArgs(userID, "LOAN", "MORTGAGE", 10).
		WillReturnRows(rows)

	liabilities, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, liabilities, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryFindManyWithCurrencyFilter(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id":  userID,
			"currency": []string{"USD", "EUR"},
		},
		Limit:  10,
		Offset: 0,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "amount", "currency", "user_id", "paid_at", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Loan 1", model.LiabilityTypeLoan, 1000.0, "USD", userID, nil, nil, nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM liabilities WHERE deleted_at IS NULL AND user_id = \$1 AND currency IN \(\$2,\$3\) ORDER BY created_at DESC LIMIT \$4`).
		WithArgs(userID, "USD", "EUR", 10).
		WillReturnRows(rows)

	liabilities, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, liabilities, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryFindManyWithCustomOrderBy(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		OrderBy: "amount DESC",
		Limit:   10,
		Offset:  0,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "amount", "currency", "user_id", "paid_at", "notes", "deleted_at", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM liabilities WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY amount DESC LIMIT \$2`).
		WithArgs(userID, 10).
		WillReturnRows(rows)

	liabilities, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, liabilities, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryScanLiabilityWithAllFields(t *testing.T) {
	db, mock, _ := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	deletedAt := time.Now()
	paidAt := time.Now()

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "amount", "currency", "user_id", "paid_at", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Loan 1", model.LiabilityTypeLoan, 1000.0, "USD", userID, paidAt, "test notes", deletedAt, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM liabilities WHERE deleted_at IS NULL AND user_id = \$1 LIMIT 1`).
		WithArgs(userID).
		WillReturnRows(rows)

	repo := NewLiabilityRepository(db)
	liability, err := repo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"user_id": userID},
	})

	assert.NoError(t, err)
	assert.NotNil(t, liability)
	assert.NotNil(t, liability.DeletedAt)
	assert.NotNil(t, liability.PaidAt)
	assert.Equal(t, "test notes", *liability.Notes)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryFindManyRowsScanError(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "amount", "currency", "user_id", "paid_at", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		"invalid-uuid", "Loan 1", model.LiabilityTypeLoan, 1000.0, "USD", userID, nil, nil, nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM liabilities WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC`).
		WithArgs(userID).
		WillReturnRows(rows)

	liabilities, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, liabilities)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryFindManyWithOffsetLimit(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		Offset: 10,
		Limit:  5,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "amount", "currency", "user_id", "paid_at", "notes", "deleted_at", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM liabilities WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC OFFSET \$2 LIMIT \$3`).
		WithArgs(userID, 10, 5).
		WillReturnRows(rows)

	liabilities, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, liabilities, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryCount(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(3)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM liabilities WHERE deleted_at IS NULL AND user_id = \$1`).
		WithArgs(userID).
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 3, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryUpdate(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	liability := &model.Liability{
		ID:       uuid.New(),
		Name:     "Updated Liability",
		Type:     model.LiabilityTypeLoan,
		Amount:   1500.0,
		Currency: "EUR",
	}

	mock.ExpectExec(`UPDATE liabilities SET name = \$2, type = \$3, amount = \$4, currency = \$5,
		paid_at = \$6, notes = \$7, deleted_at = \$8, updated_at = \$9 WHERE id = \$1`).
		WithArgs(liability.ID, liability.Name, liability.Type, liability.Amount,
			liability.Currency, liability.PaidAt, liability.Notes, liability.DeletedAt, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Update(ctx, liability)

	assert.NoError(t, err)
	assert.NotZero(t, liability.UpdatedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositorySumByUserAndCurrency(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	rows := sqlmock.NewRows([]string{"sum"}).AddRow(5000.0)

	mock.ExpectQuery(`SELECT COALESCE\(SUM\(amount\), 0\) FROM liabilities WHERE user_id = \$1 AND currency = \$2 AND deleted_at IS NULL AND paid_at IS NULL`).
		WithArgs(userID, "USD").
		WillReturnRows(rows)

	sum, err := repo.SumByUserAndCurrency(ctx, userID, "USD")

	assert.NoError(t, err)
	assert.Equal(t, 5000.0, sum)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryCreateDatabaseError(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	liability := &model.Liability{
		ID:       uuid.New(),
		Name:     "Test Liability",
		Type:     model.LiabilityTypeLoan,
		Amount:   1000.0,
		UserID:   uuid.New(),
		Currency: "USD",
	}

	mock.ExpectExec(`INSERT INTO liabilities`).
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("insert error"))

	err := repo.Create(ctx, liability)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "insert error")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryFindUniqueDatabaseError(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM liabilities WHERE deleted_at IS NULL AND id = \$1 LIMIT 1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("database error"))

	liability, err := repo.FindUnique(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, liability)
	assert.Contains(t, err.Error(), "database error")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryFindManyDatabaseError(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM liabilities WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("database error"))

	liabilities, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, liabilities)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryCountDatabaseError(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM liabilities WHERE deleted_at IS NULL AND user_id = \$1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("count error"))

	count, err := repo.Count(ctx, where)

	assert.Error(t, err)
	assert.Equal(t, 0, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryUpdateDatabaseError(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	liability := &model.Liability{
		ID:       uuid.New(),
		Name:     "Updated Liability",
		Type:     model.LiabilityTypeLoan,
		Amount:   1500.0,
		Currency: "EUR",
	}

	mock.ExpectExec(`UPDATE liabilities SET name = \$2, type = \$3, amount = \$4, currency = \$5,
		paid_at = \$6, notes = \$7, deleted_at = \$8, updated_at = \$9 WHERE id = \$1`).
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("update error"))

	err := repo.Update(ctx, liability)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "update error")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositorySumByUserAndCurrencyDatabaseError(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	mock.ExpectQuery(`SELECT COALESCE\(SUM\(amount\), 0\) FROM liabilities WHERE user_id = \$1 AND currency = \$2 AND deleted_at IS NULL AND paid_at IS NULL`).
		WithArgs(userID, "USD").
		WillReturnError(fmt.Errorf("sum error"))

	sum, err := repo.SumByUserAndCurrency(ctx, userID, "USD")

	assert.Error(t, err)
	assert.Equal(t, 0.0, sum)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestLiabilityRepositoryFindManyInvalidOrderBy(t *testing.T) {
	db, _, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": uuid.New(),
		},
		OrderBy: "invalid_column DESC",
	}

	liabilities, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, liabilities)
	assert.Contains(t, err.Error(), "invalid ORDER BY")
}

func TestLiabilityRepositoryFindManyRowsError(t *testing.T) {
	db, mock, repo := setupLiabilityRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "amount", "currency", "user_id", "paid_at", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Loan 1", model.LiabilityTypeLoan, 1000.0, "USD", userID, nil, nil, nil, time.Now(), time.Now(),
	).RowError(0, fmt.Errorf("rows error"))

	mock.ExpectQuery(`SELECT (.+) FROM liabilities WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC`).
		WithArgs(userID).
		WillReturnRows(rows)

	liabilities, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, liabilities)
}
