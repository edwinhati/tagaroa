package application

import (
	"github.com/edwinhati/tagaroa/servers/finance/internal/application/account"
	"github.com/edwinhati/tagaroa/servers/finance/internal/application/budget"
	"github.com/edwinhati/tagaroa/servers/finance/internal/application/dashboard"
	"github.com/edwinhati/tagaroa/servers/finance/internal/application/investment"
	"github.com/edwinhati/tagaroa/servers/finance/internal/application/transaction"
	"github.com/google/wire"
)

// Set provides all application services
var Set = wire.NewSet(
	account.NewService,
	budget.NewService,
	dashboard.NewService,
	investment.NewService,
	transaction.NewService,

	// Bind interfaces used by services to concrete implementations
	wire.Bind(new(transaction.AccountService), new(*account.Service)),
)
