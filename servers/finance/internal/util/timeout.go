package util

import (
	"context"
	"time"
)

const DefaultQueryTimeout = 10 * time.Second
const DefaultDBTimeout = 30 * time.Second

type TimeoutConfig struct {
	Query time.Duration
	DB    time.Duration
}

var DefaultTimeoutConfig = TimeoutConfig{
	Query: DefaultQueryTimeout,
	DB:    DefaultDBTimeout,
}

func WithTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, timeout)
}

func QueryContext(ctx context.Context, config TimeoutConfig) (context.Context, context.CancelFunc) {
	return WithTimeout(ctx, config.Query)
}

func DBContext(ctx context.Context, config TimeoutConfig) (context.Context, context.CancelFunc) {
	return WithTimeout(ctx, config.DB)
}

func IsTimeoutError(err error) bool {
	if err == context.DeadlineExceeded {
		return true
	}
	return false
}
