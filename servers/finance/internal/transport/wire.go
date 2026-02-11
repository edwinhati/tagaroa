package httphandler

import (
	"github.com/google/wire"
)

// Set provides all HTTP handlers
var Set = wire.NewSet(
	NewAccountHandler,
	NewTransactionHandler,
	NewBudgetHandler,
	NewInvestmentHandler,
	NewDashboardHandler,
)
