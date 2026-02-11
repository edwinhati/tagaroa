package client

import (
	"database/sql"
	"fmt"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/logger"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/stretchr/testify/assert"
)

func ConnectDatabase(host, user, password, name, port string) (*sql.DB, error) {
	log := logger.New()

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta",
		host, user, password, name, port)

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		log.Errorw("Failed to connect to database", "error", err)
		return nil, err
	}

	if err := db.Ping(); err != nil {
		log.Errorw("Failed to ping database", "error", err)
		return nil, err
	}

	log.Infow("Database connected successfully", "host", host, "database", name)
	return db, nil
}

func SetupMockDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock) {
	t.Helper()

	db, mock, err := sqlmock.New()
	assert.NoError(t, err)

	return db, mock
}

func SetupTestDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock) {
	return SetupMockDB(t)
}
