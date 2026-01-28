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

func setupAssetRepository(t *testing.T) (*sql.DB, sqlmock.Sqlmock, AssetRepository) {
	db, mock := client.SetupMockDB(t)
	repo := NewAssetRepository(db)
	return db, mock, repo
}

func TestAssetRepositoryCreate(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	asset := &model.Asset{
		ID:       uuid.New(),
		Name:     "Test Asset",
		Type:     model.AssetTypeStock,
		Value:    1000.0,
		UserID:   uuid.New(),
		Currency: "USD",
	}

	mock.ExpectExec(`INSERT INTO assets`).
		WithArgs(asset.ID, asset.Name, asset.Type, asset.Value, sqlmock.AnyArg(), sqlmock.AnyArg(),
			asset.Currency, asset.UserID, asset.Notes, sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Create(ctx, asset)

	assert.NoError(t, err)
	assert.NotZero(t, asset.CreatedAt)
	assert.NotZero(t, asset.UpdatedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryCreateGeneratesID(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	asset := &model.Asset{
		ID:       uuid.Nil,
		Name:     "Test Asset",
		Type:     model.AssetTypeCrypto,
		Value:    500.0,
		UserID:   uuid.New(),
		Currency: "BTC",
	}

	mock.ExpectExec(`INSERT INTO assets`).
		WithArgs(sqlmock.AnyArg(), asset.Name, asset.Type, asset.Value, sqlmock.AnyArg(), sqlmock.AnyArg(),
			asset.Currency, asset.UserID, asset.Notes, sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Create(ctx, asset)

	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, asset.ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryFindUnique(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	assetID := uuid.New()
	userID := uuid.New()
	createdAt := time.Now()
	updatedAt := time.Now()

	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": assetID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "value", "shares", "ticker", "currency", "user_id", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		assetID, "Test Asset", model.AssetTypeStock, 1000.0, nil, nil, "USD", userID, nil, nil, createdAt, updatedAt,
	)

	mock.ExpectQuery(`SELECT (.+) FROM assets WHERE deleted_at IS NULL AND id = \$1 LIMIT 1`).
		WithArgs(assetID).
		WillReturnRows(rows)

	asset, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.NotNil(t, asset)
	assert.Equal(t, assetID, asset.ID)
	assert.Equal(t, "Test Asset", asset.Name)
	assert.Equal(t, model.AssetTypeStock, asset.Type)
	assert.Equal(t, 1000.0, asset.Value)
	assert.Equal(t, userID, asset.UserID)
	assert.Equal(t, "USD", asset.Currency)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryFindUniqueNotFound(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM assets WHERE deleted_at IS NULL AND id = \$1 LIMIT 1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(sql.ErrNoRows)

	asset, err := repo.FindUnique(ctx, params)

	assert.NoError(t, err)
	assert.Nil(t, asset)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryFindMany(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
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
		"id", "name", "type", "value", "shares", "ticker", "currency", "user_id", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Asset 1", model.AssetTypeStock, 1000.0, nil, nil, "USD", userID, nil, nil, time.Now(), time.Now(),
	).AddRow(
		uuid.New(), "Asset 2", model.AssetTypeCrypto, 0.5, nil, new(string), "BTC", userID, nil, nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM assets WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC LIMIT \$2`).
		WithArgs(userID, 10).
		WillReturnRows(rows)

	assets, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, assets, 2)
	assert.Equal(t, "Asset 1", assets[0].Name)
	assert.Equal(t, "Asset 2", assets[1].Name)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryFindManyWithTypesFilter(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
			"type":    []string{"STOCK", "CRYPTO"},
		},
		Limit:  10,
		Offset: 0,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "value", "shares", "ticker", "currency", "user_id", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Asset 1", model.AssetTypeStock, 1000.0, nil, nil, "USD", userID, nil, nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM assets WHERE deleted_at IS NULL AND user_id = \$1 AND type IN \(\$2,\$3\) ORDER BY created_at DESC LIMIT \$4`).
		WithArgs(userID, "STOCK", "CRYPTO", 10).
		WillReturnRows(rows)

	assets, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, assets, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryFindManyWithCurrencyFilter(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
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
		"id", "name", "type", "value", "shares", "ticker", "currency", "user_id", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Asset 1", model.AssetTypeStock, 1000.0, nil, nil, "USD", userID, nil, nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM assets WHERE deleted_at IS NULL AND user_id = \$1 AND currency IN \(\$2,\$3\) ORDER BY created_at DESC LIMIT \$4`).
		WithArgs(userID, "USD", "EUR", 10).
		WillReturnRows(rows)

	assets, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, assets, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryFindManyWithCustomOrderBy(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		OrderBy: "name ASC",
		Limit:   10,
		Offset:  0,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "value", "shares", "ticker", "currency", "user_id", "notes", "deleted_at", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM assets WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY name ASC LIMIT \$2`).
		WithArgs(userID, 10).
		WillReturnRows(rows)

	assets, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, assets, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryScanAssetWithAllFields(t *testing.T) {
	db, mock, _ := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()
	deletedAt := time.Now()
	shares := 100.5
	ticker := "AAPL"

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "value", "shares", "ticker", "currency", "user_id", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Asset 1", model.AssetTypeStock, 1000.0, shares, ticker, "USD", userID, "test notes", deletedAt, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM assets WHERE deleted_at IS NULL AND user_id = \$1 LIMIT 1`).
		WithArgs(userID).
		WillReturnRows(rows)

	repo := NewAssetRepository(db)
	asset, err := repo.FindUnique(ctx, util.FindUniqueParams{
		Where: map[string]any{"user_id": userID},
	})

	assert.NoError(t, err)
	assert.NotNil(t, asset)
	assert.NotNil(t, asset.DeletedAt)
	assert.NotNil(t, asset.Shares)
	assert.NotNil(t, asset.Ticker)
	assert.Equal(t, shares, *asset.Shares)
	assert.Equal(t, ticker, *asset.Ticker)
	assert.Equal(t, "test notes", *asset.Notes)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryFindManyRowsScanError(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "value", "shares", "ticker", "currency", "user_id", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		"invalid-uuid", "Asset 1", model.AssetTypeStock, 1000.0, nil, nil, "USD", userID, nil, nil, time.Now(), time.Now(),
	)

	mock.ExpectQuery(`SELECT (.+) FROM assets WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC`).
		WithArgs(userID).
		WillReturnRows(rows)

	assets, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, assets)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryFindManyWithOffsetLimit(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
		Offset: 20,
		Limit:  5,
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "value", "shares", "ticker", "currency", "user_id", "notes", "deleted_at", "created_at", "updated_at",
	})

	mock.ExpectQuery(`SELECT (.+) FROM assets WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC OFFSET \$2 LIMIT \$3`).
		WithArgs(userID, 20, 5).
		WillReturnRows(rows)

	assets, err := repo.FindMany(ctx, params)

	assert.NoError(t, err)
	assert.Len(t, assets, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryCount(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	where := map[string]any{
		"user_id": userID,
	}

	rows := sqlmock.NewRows([]string{"count"}).AddRow(5)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM assets WHERE deleted_at IS NULL AND user_id = \$1`).
		WithArgs(userID).
		WillReturnRows(rows)

	count, err := repo.Count(ctx, where)

	assert.NoError(t, err)
	assert.Equal(t, 5, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryUpdate(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	asset := &model.Asset{
		ID:       uuid.New(),
		Name:     "Updated Asset",
		Type:     model.AssetTypeStock,
		Value:    1500.0,
		Currency: "EUR",
	}

	mock.ExpectExec(`UPDATE assets SET name = \$2, type = \$3, value = \$4, shares = \$5, ticker = \$6,
		currency = \$7, notes = \$8, deleted_at = \$9, updated_at = \$10 WHERE id = \$1`).
		WithArgs(asset.ID, asset.Name, asset.Type, asset.Value, sqlmock.AnyArg(), sqlmock.AnyArg(),
			asset.Currency, asset.Notes, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Update(ctx, asset)

	assert.NoError(t, err)
	assert.NotZero(t, asset.UpdatedAt)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositorySumByUserAndCurrency(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	rows := sqlmock.NewRows([]string{"sum"}).AddRow(10000.0)

	mock.ExpectQuery(`SELECT COALESCE\(SUM\(value\), 0\) FROM assets WHERE user_id = \$1 AND currency = \$2 AND deleted_at IS NULL`).
		WithArgs(userID, "USD").
		WillReturnRows(rows)

	sum, err := repo.SumByUserAndCurrency(ctx, userID, "USD")

	assert.NoError(t, err)
	assert.Equal(t, 10000.0, sum)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryCreateDatabaseError(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	asset := &model.Asset{
		ID:       uuid.New(),
		Name:     "Test Asset",
		Type:     model.AssetTypeStock,
		Value:    1000.0,
		UserID:   uuid.New(),
		Currency: "USD",
	}

	mock.ExpectExec(`INSERT INTO assets`).
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("insert error"))

	err := repo.Create(ctx, asset)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "insert error")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryFindUniqueDatabaseError(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindUniqueParams{
		Where: map[string]any{
			"id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM assets WHERE deleted_at IS NULL AND id = \$1 LIMIT 1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("database error"))

	asset, err := repo.FindUnique(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, asset)
	assert.Contains(t, err.Error(), "database error")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryFindManyDatabaseError(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": uuid.New(),
		},
	}

	mock.ExpectQuery(`SELECT (.+) FROM assets WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("database error"))

	assets, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, assets)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryCountDatabaseError(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	where := map[string]any{
		"user_id": uuid.New(),
	}

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM assets WHERE deleted_at IS NULL AND user_id = \$1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("count error"))

	count, err := repo.Count(ctx, where)

	assert.Error(t, err)
	assert.Equal(t, 0, count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryUpdateDatabaseError(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	asset := &model.Asset{
		ID:       uuid.New(),
		Name:     "Updated Asset",
		Type:     model.AssetTypeStock,
		Value:    1500.0,
		Currency: "EUR",
	}

	mock.ExpectExec(`UPDATE assets SET name = \$2, type = \$3, value = \$4, shares = \$5, ticker = \$6,
		currency = \$7, notes = \$8, deleted_at = \$9, updated_at = \$10 WHERE id = \$1`).
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnError(fmt.Errorf("update error"))

	err := repo.Update(ctx, asset)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "update error")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositorySumByUserAndCurrencyDatabaseError(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	mock.ExpectQuery(`SELECT COALESCE\(SUM\(value\), 0\) FROM assets WHERE user_id = \$1 AND currency = \$2 AND deleted_at IS NULL`).
		WithArgs(userID, "USD").
		WillReturnError(fmt.Errorf("sum error"))

	sum, err := repo.SumByUserAndCurrency(ctx, userID, "USD")

	assert.Error(t, err)
	assert.Equal(t, 0.0, sum)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetRepositoryFindManyInvalidOrderBy(t *testing.T) {
	db, _, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": uuid.New(),
		},
		OrderBy: "invalid_column DESC",
	}

	assets, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, assets)
	assert.Contains(t, err.Error(), "invalid ORDER BY")
}

func TestAssetRepositoryFindManyRowsError(t *testing.T) {
	db, mock, repo := setupAssetRepository(t)
	defer db.Close()

	ctx := context.Background()
	userID := uuid.New()

	params := util.FindManyParams{
		Where: map[string]any{
			"user_id": userID,
		},
	}

	rows := sqlmock.NewRows([]string{
		"id", "name", "type", "value", "shares", "ticker", "currency", "user_id", "notes", "deleted_at", "created_at", "updated_at",
	}).AddRow(
		uuid.New(), "Asset 1", model.AssetTypeStock, 1000.0, nil, nil, "USD", userID, nil, nil, time.Now(), time.Now(),
	).RowError(0, fmt.Errorf("rows error"))

	mock.ExpectQuery(`SELECT (.+) FROM assets WHERE deleted_at IS NULL AND user_id = \$1 ORDER BY created_at DESC`).
		WithArgs(userID).
		WillReturnRows(rows)

	assets, err := repo.FindMany(ctx, params)

	assert.Error(t, err)
	assert.Nil(t, assets)
}
