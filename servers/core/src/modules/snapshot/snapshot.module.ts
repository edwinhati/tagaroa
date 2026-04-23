import { Module } from "@nestjs/common";
import { SnapshotCreatedHandler } from "./application/event-handlers/snapshot-created.handler";
import { GetNetWorthHistoryUseCase } from "./application/use-cases/get-net-worth-history.use-case";
import { GetPortfolioHistoryUseCase } from "./application/use-cases/get-portfolio-history.use-case";
import { NET_WORTH_SNAPSHOT_REPOSITORY } from "./domain/repositories/net-worth-snapshot.repository.interface";
import { PORTFOLIO_SNAPSHOT_REPOSITORY } from "./domain/repositories/portfolio-snapshot.repository.interface";
import { DrizzleNetWorthSnapshotRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-net-worth-snapshot.repository";
import { DrizzlePortfolioSnapshotRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-portfolio-snapshot.repository";

@Module({
  providers: [
    {
      provide: NET_WORTH_SNAPSHOT_REPOSITORY,
      useClass: DrizzleNetWorthSnapshotRepository,
    },
    {
      provide: PORTFOLIO_SNAPSHOT_REPOSITORY,
      useClass: DrizzlePortfolioSnapshotRepository,
    },
    SnapshotCreatedHandler,
    GetNetWorthHistoryUseCase,
    GetPortfolioHistoryUseCase,
  ],
  exports: [
    NET_WORTH_SNAPSHOT_REPOSITORY,
    PORTFOLIO_SNAPSHOT_REPOSITORY,
    GetNetWorthHistoryUseCase,
    GetPortfolioHistoryUseCase,
  ],
})
export class SnapshotModule {}
