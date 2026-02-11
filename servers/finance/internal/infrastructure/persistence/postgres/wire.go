package postgres

import (
	"github.com/google/wire"

	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/account"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/budget"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/investment"
	"github.com/edwinhati/tagaroa/servers/finance/internal/domain/transaction"
)

// Set provides all postgres repositories
var Set = wire.NewSet(
	NewAccountRepository,
	wire.Bind(new(account.Repository), new(*AccountRepository)),
	NewTransactionRepository,
	wire.Bind(new(transaction.Repository), new(*TransactionRepository)),
	NewBudgetRepository,
	wire.Bind(new(budget.Repository), new(*BudgetRepository)),
	NewAssetRepository,
	wire.Bind(new(investment.AssetRepository), new(*AssetRepository)),
	NewLiabilityRepository,
	wire.Bind(new(investment.LiabilityRepository), new(*LiabilityRepository)),
	NewTransactionManager,
	// Assuming TransactionManager is used directly or via an interface.
	// Based on service.go reading, TransactionManager is an interface in application/transaction/service.go
	// But usually it's defined in domain/shared or similar.
	// Let's check where TransactionManager interface is defined.
)
