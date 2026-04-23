---
"core-service": minor
---

## Snapshot Module

Extracted time-series snapshot storage from Finance and Investment modules into a dedicated Snapshot module.

### New Features

- **Snapshot Module** (`src/modules/snapshot/`): New module for storing and querying historical snapshots
  - `snapshot.net_worth` table: Stores weekly net worth snapshots with dimensional breakdowns
  - `snapshot.portfolio` table: Stores portfolio NAV snapshots with position data
  - Event-driven architecture: Finance/Investment emit `snapshot.created` events; Snapshot module persists them
  - Query use cases: `GetNetWorthHistoryUseCase`, `GetPortfolioHistoryUseCase`

### Architecture Changes

- **Finance Module**: `CreateNetWorthSnapshotUseCase` now emits `snapshot.created` events instead of writing directly to the database. The scheduler iterates all active users and generates snapshots weekly.
- **Investment Module**: `SnapshotPortfolioUseCase` emits `snapshot.created` events. Portfolio performance metrics and history queries now read from the Snapshot module.
- **Removed**: Old `finance.net_worth_snapshots` and `investment.portfolio_snapshots` tables, repositories, and mappers.

### Database Schema

```
snapshot.net_worth
  - id, user_id, snapshot_date
  - total_assets, total_liabilities, net_worth
  - assets_breakdown (JSONB), liabilities_breakdown (JSONB)
  - fx_rates_used (JSONB), fx_rate_date, fx_rate_source

snapshot.portfolio
  - id, portfolio_id, user_id, timestamp
  - nav, cash, positions_snapshot (JSONB)
```

### Migration Required

Run `drizzle-kit generate` and `drizzle-kit migrate` to create the new `snapshot` schema and tables.
