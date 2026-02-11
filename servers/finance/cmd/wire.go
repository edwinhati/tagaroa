//go:build wireinject
// +build wireinject

package main

import (
	"github.com/edwinhati/tagaroa/servers/finance/internal/application"
	"github.com/edwinhati/tagaroa/servers/finance/internal/application/dashboard"
	"github.com/edwinhati/tagaroa/servers/finance/internal/application/transaction"
	"github.com/edwinhati/tagaroa/servers/finance/internal/config"
	"github.com/edwinhati/tagaroa/servers/finance/internal/event"
	"github.com/edwinhati/tagaroa/servers/finance/internal/infrastructure/persistence/postgres"
	httphandler "github.com/edwinhati/tagaroa/servers/finance/internal/transport"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/logger"
	"github.com/google/wire"
)

func InitializeApp(cfg *config.Config) (*App, func(), error) {
	wire.Build(
		// Providers
		ProvideDB,
		ProvideOIDCClient,
		ProvideKafkaProducer,
		ProvideEventPublisher,
		logger.New,

		// Sets
		postgres.Set,
		application.Set,
		httphandler.Set,

		// Bindings
		wire.Bind(new(transaction.TransactionManager), new(*postgres.TransactionManager)),
		wire.Bind(new(dashboard.BudgetRepository), new(*postgres.BudgetRepository)),
		wire.Bind(new(dashboard.AssetRepository), new(*postgres.AssetRepository)),
		wire.Bind(new(dashboard.LiabilityRepository), new(*postgres.LiabilityRepository)),
		event.NewDomainEventPublisher,

		// App
		NewApp,
	)
	return &App{}, nil, nil
}
