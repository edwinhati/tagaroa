package main

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/edwinhati/tagaroa/servers/finance/internal/config"
	"github.com/edwinhati/tagaroa/servers/finance/internal/event"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/client"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/kafka"
	_ "github.com/jackc/pgx/v5/stdlib"
)

func ProvideDB(cfg *config.Config) (*sql.DB, func(), error) {
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.Name,
	)

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, nil, err
	}

	cleanup := func() {
		db.Close()
	}
	return db, cleanup, nil
}

func ProvideOIDCClient(cfg *config.Config) (*client.OIDCClient, error) {
	oidcCfg := client.OIDCConfig{
		IssuerURL: cfg.OIDC.IssuerURL(),
		ClientID:  cfg.OIDC.ClientID,
	}
	// Use context with timeout for OIDC initialization
	// This allows retry logic to wait for auth-server to be ready
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	return client.NewOIDCClient(ctx, oidcCfg)
}

func ProvideKafkaProducer(cfg *config.Config) (kafka.Producer, func(), error) {
	if len(cfg.Kafka.Brokers) == 0 {
		return nil, func() {}, nil
	}

	kCfg := kafka.Config{
		Brokers:  cfg.Kafka.Brokers,
		ClientID: cfg.Kafka.ClientID,
	}
	producer, err := kafka.NewProducer(kCfg)
	if err != nil {
		return nil, nil, err
	}
	return producer, func() { producer.Close() }, nil
}

func ProvideEventPublisher(producer kafka.Producer) event.EventPublisher {
	if producer == nil {
		return &noOpPublisher{}
	}
	return event.NewKafkaEventPublisher(producer, "finance.events")
}

type noOpPublisher struct{}

func (p *noOpPublisher) Publish(ctx context.Context, event *event.DomainEvent) error {
	return nil
}
