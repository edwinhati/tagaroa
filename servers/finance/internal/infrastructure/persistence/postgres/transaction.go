package postgres

import (
	"context"
	"database/sql"

	"github.com/edwinhati/tagaroa/servers/finance/pkg/logger"
	"go.uber.org/zap"
)

// TransactionManager manages database transactions
type TransactionManager struct {
	db  *sql.DB
	log *zap.SugaredLogger
}

// NewTransactionManager creates a new transaction manager
func NewTransactionManager(db *sql.DB) *TransactionManager {
	return &TransactionManager{
		db:  db,
		log: logger.New().With("component", "transaction_manager"),
	}
}

// InTransaction executes a function within a database transaction
// If the function returns an error, the transaction is rolled back
// If the function returns nil, the transaction is committed
func (tm *TransactionManager) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	tx, err := tm.db.BeginTx(ctx, nil)
	if err != nil {
		tm.log.Errorw("Failed to begin transaction", "error", err)
		return err
	}

	// Create a new context with the transaction
	txCtx := contextWithTransaction(ctx, tx)

	// Ensure we handle panics
	defer func() {
		if r := recover(); r != nil {
			_ = tx.Rollback()
			panic(r) // re-throw panic after rollback
		}
	}()

	// Execute the function
	if err := fn(txCtx); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			tm.log.Errorw("Failed to rollback transaction", "error", rbErr)
		}
		return err
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		tm.log.Errorw("Failed to commit transaction", "error", err)
		return err
	}

	tm.log.Debugw("Transaction committed successfully")
	return nil
}

// transactionKey is the context key for storing the transaction
type contextKey string

const transactionKey contextKey = "transaction"

// contextWithTransaction adds a transaction to the context
func contextWithTransaction(ctx context.Context, tx *sql.Tx) context.Context {
	return context.WithValue(ctx, transactionKey, tx)
}

// TransactionFromContext retrieves the transaction from the context
// Returns nil if no transaction is in progress
func TransactionFromContext(ctx context.Context) *sql.Tx {
	if tx, ok := ctx.Value(transactionKey).(*sql.Tx); ok {
		return tx
	}
	return nil
}

// Executor is an interface that can execute queries
// Both sql.DB and sql.Tx implement this interface
type Executor interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	PrepareContext(ctx context.Context, query string) (*sql.Stmt, error)
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
}

// GetExecutor returns the appropriate executor (DB or Tx) from the context
func GetExecutor(ctx context.Context, db *sql.DB) Executor {
	if tx := TransactionFromContext(ctx); tx != nil {
		return tx
	}
	return db
}
