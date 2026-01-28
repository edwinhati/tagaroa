package client

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type ClickHouseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
}

func ConnectClickHouse(cfg ClickHouseConfig) (driver.Conn, error) {
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)},
		Auth: clickhouse.Auth{
			Database: cfg.Database,
			Username: cfg.User,
			Password: cfg.Password,
		},
	})
	if err != nil {
		slog.Error("Failed to connect to ClickHouse", "error", err)
		return nil, err
	}

	if err := conn.Ping(context.Background()); err != nil {
		slog.Error("Failed to ping ClickHouse", "error", err)
		return nil, err
	}

	slog.Info("ClickHouse connected successfully")
	return conn, nil
}
