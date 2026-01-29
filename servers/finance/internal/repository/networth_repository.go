package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
	"github.com/edwinhati/tagaroa/servers/finance/internal/model"
	"github.com/edwinhati/tagaroa/servers/finance/internal/util"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type NetworthRepository interface {
	Insert(ctx context.Context, record *model.NetworthHistory) error
	GetHistory(ctx context.Context, userID uuid.UUID, currency string, from, to time.Time) ([]*model.NetworthHistory, error)
	GetLatest(ctx context.Context, userID uuid.UUID, currency string) (*model.NetworthHistory, error)
	InitSchema(ctx context.Context) error
}

type networthRepository struct {
	conn driver.Conn
	log  *zap.SugaredLogger
}

func NewNetworthRepository(conn driver.Conn) NetworthRepository {
	return &networthRepository{
		conn: conn,
		log:  logger.New().With("repository", "networth"),
	}
}

func (r *networthRepository) InitSchema(ctx context.Context) error {
	r.log.Infow("Initializing networth_history schema")

	return r.conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS networth_history (
			id UUID,
			time DateTime64(3),
			user_id UUID,
			total_assets Decimal(15, 2),
			total_liabilities Decimal(15, 2),
			networth Decimal(15, 2),
			currency LowCardinality(String)
	) ENGINE = MergeTree()
		ORDER BY (user_id, currency, time)
		TTL toDateTime(time) + INTERVAL 1 YEAR
	`)
}

func (r *networthRepository) Insert(ctx context.Context, record *model.NetworthHistory) error {
	ctx, cancel := util.DBContext(ctx, util.DefaultTimeoutConfig)
	defer cancel()

	if record.ID == uuid.Nil {
		record.ID = uuid.New()
	}
	return r.conn.Exec(ctx, `
		INSERT INTO networth_history (id, time, user_id, total_assets, total_liabilities, networth, currency)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		record.ID, record.Time, record.UserID, record.TotalAssets, record.TotalLiabilities, record.Networth, record.Currency,
	)
}

func (r *networthRepository) GetHistory(ctx context.Context, userID uuid.UUID, currency string, from, to time.Time) ([]*model.NetworthHistory, error) {
	ctx, cancel := util.QueryContext(ctx, util.DefaultTimeoutConfig)
	defer cancel()

	rows, err := r.conn.Query(ctx, `
		SELECT id, time, user_id, total_assets, total_liabilities, networth, currency
		FROM networth_history
		WHERE user_id = ? AND currency = ? AND time >= ? AND time <= ?
		ORDER BY time ASC`, userID, currency, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []*model.NetworthHistory
	for rows.Next() {
		var h model.NetworthHistory
		if err := rows.Scan(&h.ID, &h.Time, &h.UserID, &h.TotalAssets, &h.TotalLiabilities, &h.Networth, &h.Currency); err != nil {
			return nil, err
		}
		history = append(history, &h)
	}
	return history, nil
}

func (r *networthRepository) GetLatest(ctx context.Context, userID uuid.UUID, currency string) (*model.NetworthHistory, error) {
	ctx, cancel := util.QueryContext(ctx, util.DefaultTimeoutConfig)
	defer cancel()

	row := r.conn.QueryRow(ctx, `
		SELECT id, time, user_id, total_assets, total_liabilities, networth, currency
		FROM networth_history
		WHERE user_id = ? AND currency = ?
		ORDER BY time DESC
		LIMIT 1`, userID, currency)

	var h model.NetworthHistory
	if err := row.Scan(&h.ID, &h.Time, &h.UserID, &h.TotalAssets, &h.TotalLiabilities, &h.Networth, &h.Currency); err != nil {
		return nil, fmt.Errorf("failed to get latest networth history: %w", err)
	}
	return &h, nil
}
