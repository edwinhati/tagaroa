package client

import (
	"context"
	"fmt"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/logger"
)

type ClickHouseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
}

func ConnectClickHouse(cfg ClickHouseConfig) (driver.Conn, error) {
	log := logger.New()

	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)},
		Auth: clickhouse.Auth{
			Database: cfg.Database,
			Username: cfg.User,
			Password: cfg.Password,
		},
	})
	if err != nil {
		log.Errorw("Failed to connect to ClickHouse", "error", err)
		return nil, err
	}

	if err := conn.Ping(context.Background()); err != nil {
		log.Errorw("Failed to ping ClickHouse", "error", err)
		return nil, err
	}

	log.Infow("ClickHouse connected successfully", "host", cfg.Host, "database", cfg.Database)
	return conn, nil
}
