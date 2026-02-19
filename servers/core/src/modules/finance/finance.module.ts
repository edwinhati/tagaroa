import { Module } from "@nestjs/common";
import { TransactionSideEffectsService } from "./application/services/transaction-side-effects.service";
import { CreateAccountUseCase } from "./application/use-cases/create-account.use-case";
import { CreateAssetUseCase } from "./application/use-cases/create-asset.use-case";
import { CreateBudgetUseCase } from "./application/use-cases/create-budget.use-case";
import { CreateLiabilityUseCase } from "./application/use-cases/create-liability.use-case";
import { CreateTransactionUseCase } from "./application/use-cases/create-transaction.use-case";
import { DeleteAccountUseCase } from "./application/use-cases/delete-account.use-case";
import { DeleteAssetUseCase } from "./application/use-cases/delete-asset.use-case";
import { DeleteBudgetUseCase } from "./application/use-cases/delete-budget.use-case";
import { DeleteLiabilityUseCase } from "./application/use-cases/delete-liability.use-case";
import { DeleteTransactionUseCase } from "./application/use-cases/delete-transaction.use-case";
import { GetAccountUseCase } from "./application/use-cases/get-account.use-case";
import { GetAccountAggregationsUseCase } from "./application/use-cases/get-account-aggregations.use-case";
import { GetAccountsUseCase } from "./application/use-cases/get-accounts.use-case";
import { GetAssetUseCase } from "./application/use-cases/get-asset.use-case";
import { GetAssetsUseCase } from "./application/use-cases/get-assets.use-case";
import { GetBudgetByMonthYearUseCase } from "./application/use-cases/get-budget-by-month-year.use-case";
import { GetBudgetPerformanceUseCase } from "./application/use-cases/get-budget-performance.use-case";
import { GetBudgetsUseCase } from "./application/use-cases/get-budgets.use-case";
import { GetExpenseBreakdownUseCase } from "./application/use-cases/get-expense-breakdown.use-case";
import { GetInsightsUseCase } from "./application/use-cases/get-insights.use-case";
import { GetLiabilitiesUseCase } from "./application/use-cases/get-liabilities.use-case";
import { GetLiabilityUseCase } from "./application/use-cases/get-liability.use-case";
import { GetNetWorthUseCase } from "./application/use-cases/get-net-worth.use-case";
import { GetSummaryUseCase } from "./application/use-cases/get-summary.use-case";
import { GetTransactionUseCase } from "./application/use-cases/get-transaction.use-case";
import { GetTransactionTrendsUseCase } from "./application/use-cases/get-transaction-trends.use-case";
import { GetTransactionTypesUseCase } from "./application/use-cases/get-transaction-types.use-case";
import { GetTransactionsUseCase } from "./application/use-cases/get-transactions.use-case";
import { UpdateAccountUseCase } from "./application/use-cases/update-account.use-case";
import { UpdateAssetUseCase } from "./application/use-cases/update-asset.use-case";
import { UpdateBudgetUseCase } from "./application/use-cases/update-budget.use-case";
import { UpdateBudgetItemUseCase } from "./application/use-cases/update-budget-item.use-case";
import { UpdateLiabilityUseCase } from "./application/use-cases/update-liability.use-case";
import { UpdateTransactionUseCase } from "./application/use-cases/update-transaction.use-case";
import { ACCOUNT_REPOSITORY } from "./domain/repositories/account.repository.interface";
import { ASSET_REPOSITORY } from "./domain/repositories/asset.repository.interface";
import { BUDGET_REPOSITORY } from "./domain/repositories/budget.repository.interface";
import { BUDGET_ITEM_REPOSITORY } from "./domain/repositories/budget-item.repository.interface";
import { LIABILITY_REPOSITORY } from "./domain/repositories/liability.repository.interface";
import { NET_WORTH_SNAPSHOT_REPOSITORY } from "./domain/repositories/net-worth-snapshot.repository.interface";
import { TRANSACTION_REPOSITORY } from "./domain/repositories/transaction.repository.interface";
import { DrizzleAccountRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-account.repository";
import { DrizzleAssetRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-asset.repository";
import { DrizzleBudgetRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-budget.repository";
import { DrizzleBudgetItemRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-budget-item.repository";
import { DrizzleLiabilityRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-liability.repository";
import { DrizzleNetWorthSnapshotRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-net-worth-snapshot.repository";
import { DrizzleTransactionRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-transaction.repository";
import { AccountController } from "./presentation/http/account.controller";
import { AssetController } from "./presentation/http/asset.controller";
import { BudgetController } from "./presentation/http/budget.controller";
import { DashboardController } from "./presentation/http/dashboard.controller";
import { LiabilityController } from "./presentation/http/liability.controller";
import { TransactionController } from "./presentation/http/transaction.controller";

@Module({
  controllers: [
    AccountController,
    AssetController,
    BudgetController,
    LiabilityController,
    TransactionController,
    DashboardController,
  ],
  providers: [
    {
      provide: ACCOUNT_REPOSITORY,
      useClass: DrizzleAccountRepository,
    },
    {
      provide: BUDGET_REPOSITORY,
      useClass: DrizzleBudgetRepository,
    },
    {
      provide: BUDGET_ITEM_REPOSITORY,
      useClass: DrizzleBudgetItemRepository,
    },
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: DrizzleTransactionRepository,
    },
    {
      provide: ASSET_REPOSITORY,
      useClass: DrizzleAssetRepository,
    },
    {
      provide: LIABILITY_REPOSITORY,
      useClass: DrizzleLiabilityRepository,
    },
    {
      provide: NET_WORTH_SNAPSHOT_REPOSITORY,
      useClass: DrizzleNetWorthSnapshotRepository,
    },
    CreateAccountUseCase,
    GetAccountsUseCase,
    GetAccountUseCase,
    UpdateAccountUseCase,
    DeleteAccountUseCase,
    GetBudgetsUseCase,
    GetBudgetByMonthYearUseCase,
    CreateBudgetUseCase,
    UpdateBudgetUseCase,
    UpdateBudgetItemUseCase,
    DeleteBudgetUseCase,
    TransactionSideEffectsService,
    CreateTransactionUseCase,
    GetTransactionUseCase,
    GetTransactionsUseCase,
    UpdateTransactionUseCase,
    DeleteTransactionUseCase,
    GetTransactionTypesUseCase,
    GetSummaryUseCase,
    GetBudgetPerformanceUseCase,
    GetExpenseBreakdownUseCase,
    GetTransactionTrendsUseCase,
    GetAccountAggregationsUseCase,
    GetNetWorthUseCase,
    GetInsightsUseCase,
    CreateAssetUseCase,
    GetAssetsUseCase,
    GetAssetUseCase,
    UpdateAssetUseCase,
    DeleteAssetUseCase,
    CreateLiabilityUseCase,
    GetLiabilitiesUseCase,
    GetLiabilityUseCase,
    UpdateLiabilityUseCase,
    DeleteLiabilityUseCase,
  ],
})
export class FinanceModule {}
