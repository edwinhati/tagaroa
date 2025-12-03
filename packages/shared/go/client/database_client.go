package client

import (
	"database/sql"
	"fmt"
	"log/slog"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/stretchr/testify/assert"
)

// ConnectDatabase initializes and returns a new database connection.
func ConnectDatabase(host, user, password, name, port string) (*sql.DB, error) {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta",
		host, user, password, name, port)

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		slog.Error("Failed to connect to database", "error", err)
		return nil, err
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		slog.Error("Failed to ping database", "error", err)
		return nil, err
	}

	slog.Info("Database connected successfully")
	return db, nil
}

// SetupMockDB initializes a sqlmock-backed database for repository tests.
func SetupMockDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock) {
	t.Helper()

	db, mock, err := sqlmock.New()
	assert.NoError(t, err)

	return db, mock
}

// SetupTestDB is deprecated; prefer SetupMockDB for new tests.
func SetupTestDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock) {
	return SetupMockDB(t)
}
