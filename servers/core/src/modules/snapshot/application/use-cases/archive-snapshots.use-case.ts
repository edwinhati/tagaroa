import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  type IStorageService,
  STORAGE_SERVICE,
} from "../../../storage/domain/services/storage.service.interface";
import { NetWorthSnapshot } from "../../domain/entities/net-worth-snapshot.entity";
import { PortfolioSnapshot } from "../../domain/entities/portfolio-snapshot.entity";
import {
  type INetWorthSnapshotRepository,
  NET_WORTH_SNAPSHOT_REPOSITORY,
} from "../../domain/repositories/net-worth-snapshot.repository.interface";
import {
  type IPortfolioSnapshotRepository,
  PORTFOLIO_SNAPSHOT_REPOSITORY,
} from "../../domain/repositories/portfolio-snapshot.repository.interface";

export interface ArchiveSnapshotsDto {
  olderThanDays: number;
}

export interface ArchiveResult {
  netWorthArchived: number;
  portfolioArchived: number;
  failed: number;
}

@Injectable()
export class ArchiveSnapshotsUseCase {
  private readonly logger = new Logger(ArchiveSnapshotsUseCase.name);

  constructor(
    @Inject(NET_WORTH_SNAPSHOT_REPOSITORY)
    private readonly netWorthRepository: INetWorthSnapshotRepository,
    @Inject(PORTFOLIO_SNAPSHOT_REPOSITORY)
    private readonly portfolioRepository: IPortfolioSnapshotRepository,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
  ) {}

  async execute(dto: ArchiveSnapshotsDto): Promise<ArchiveResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dto.olderThanDays);

    this.logger.log(
      `Starting snapshot archive for snapshots older than ${cutoffDate.toISOString()}`,
    );

    const netWorthSnapshots =
      await this.netWorthRepository.findUnarchivedBeforeDate(cutoffDate);
    const portfolioSnapshots =
      await this.portfolioRepository.findUnarchivedBeforeDate(cutoffDate);

    this.logger.log(
      `Found ${netWorthSnapshots.length} net worth and ${portfolioSnapshots.length} portfolio snapshots to archive`,
    );

    let netWorthArchived = 0;
    let portfolioArchived = 0;
    let failed = 0;

    // Archive net worth snapshots by user
    const netWorthByUser = this.groupByUser(netWorthSnapshots);
    for (const [userId, snapshots] of netWorthByUser) {
      try {
        const datePart = cutoffDate.toISOString().slice(0, 10);
        const archiveKey = `snapshots/net-worth/${userId}/${datePart}.json`;
        const buffer = Buffer.from(
          JSON.stringify(
            snapshots.map((s) => ({
              id: s.id,
              snapshotDate: s.snapshotDate,
              totalAssets: s.totalAssets,
              totalLiabilities: s.totalLiabilities,
              netWorth: s.netWorth,
              baseCurrency: s.baseCurrency,
              assetsBreakdown: s.assetsBreakdown,
              liabilitiesBreakdown: s.liabilitiesBreakdown,
              fxRatesUsed: s.fxRatesUsed,
              fxRateDate: s.fxRateDate,
              fxRateSource: s.fxRateSource,
            })),
          ),
        );

        await this.storageService.upload(
          archiveKey,
          buffer,
          "application/json",
        );

        for (const snapshot of snapshots) {
          await this.netWorthRepository.markAsArchived(snapshot.id, archiveKey);
        }
        netWorthArchived += snapshots.length;
        this.logger.log(
          `Archived ${snapshots.length} net worth snapshots for user ${userId}`,
        );
      } catch (error) {
        failed += snapshots.length;
        this.logger.error(
          `Failed to archive net worth snapshots for user ${userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    // Archive portfolio snapshots by portfolio
    const portfolioById = this.groupByPortfolio(portfolioSnapshots);
    for (const [portfolioId, snapshots] of portfolioById) {
      try {
        const datePart = cutoffDate.toISOString().slice(0, 10);
        const archiveKey = `snapshots/portfolio/${portfolioId}/${datePart}.json`;
        const buffer = Buffer.from(
          JSON.stringify(
            snapshots.map((s) => ({
              id: s.id,
              timestamp: s.timestamp,
              nav: s.nav,
              cash: s.cash,
              positionsSnapshot: s.positionsSnapshot,
            })),
          ),
        );

        await this.storageService.upload(
          archiveKey,
          buffer,
          "application/json",
        );

        for (const snapshot of snapshots) {
          await this.portfolioRepository.markAsArchived(
            snapshot.id,
            archiveKey,
          );
        }
        portfolioArchived += snapshots.length;
        this.logger.log(
          `Archived ${snapshots.length} portfolio snapshots for portfolio ${portfolioId}`,
        );
      } catch (error) {
        failed += snapshots.length;
        this.logger.error(
          `Failed to archive portfolio snapshots for portfolio ${portfolioId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(
      `Archive completed: ${netWorthArchived} net worth, ${portfolioArchived} portfolio, ${failed} failed`,
    );

    return { netWorthArchived, portfolioArchived, failed };
  }

  private groupByUser(
    snapshots: NetWorthSnapshot[],
  ): Map<string, NetWorthSnapshot[]> {
    const groups = new Map<string, NetWorthSnapshot[]>();
    for (const snapshot of snapshots) {
      const existing = groups.get(snapshot.userId) || [];
      existing.push(snapshot);
      groups.set(snapshot.userId, existing);
    }
    return groups;
  }

  private groupByPortfolio(
    snapshots: PortfolioSnapshot[],
  ): Map<string, PortfolioSnapshot[]> {
    const groups = new Map<string, PortfolioSnapshot[]>();
    for (const snapshot of snapshots) {
      const existing = groups.get(snapshot.portfolioId) || [];
      existing.push(snapshot);
      groups.set(snapshot.portfolioId, existing);
    }
    return groups;
  }
}
