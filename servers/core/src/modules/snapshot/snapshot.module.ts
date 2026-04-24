import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { SnapshotCreatedHandler } from "./application/event-handlers/snapshot-created.handler";
import { ArchiveSnapshotsUseCase } from "./application/use-cases/archive-snapshots.use-case";
import { GetNetWorthHistoryUseCase } from "./application/use-cases/get-net-worth-history.use-case";
import { GetPortfolioHistoryUseCase } from "./application/use-cases/get-portfolio-history.use-case";
import { NET_WORTH_SNAPSHOT_REPOSITORY } from "./domain/repositories/net-worth-snapshot.repository.interface";
import { PORTFOLIO_SNAPSHOT_REPOSITORY } from "./domain/repositories/portfolio-snapshot.repository.interface";
import { DrizzleNetWorthSnapshotRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-net-worth-snapshot.repository";
import { DrizzlePortfolioSnapshotRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-portfolio-snapshot.repository";
import { SnapshotArchiveScheduler } from "./infrastructure/scheduler/snapshot-archive.scheduler";

@Module({
  imports: [StorageModule],
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
    ArchiveSnapshotsUseCase,
    SnapshotArchiveScheduler,
  ],
  exports: [
    NET_WORTH_SNAPSHOT_REPOSITORY,
    PORTFOLIO_SNAPSHOT_REPOSITORY,
    GetNetWorthHistoryUseCase,
    GetPortfolioHistoryUseCase,
    ArchiveSnapshotsUseCase,
  ],
})
export class SnapshotModule {}
