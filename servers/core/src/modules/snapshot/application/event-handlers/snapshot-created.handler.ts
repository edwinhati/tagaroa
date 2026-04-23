import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { NetWorthSnapshot } from "../../domain/entities/net-worth-snapshot.entity";
import { PortfolioSnapshot } from "../../domain/entities/portfolio-snapshot.entity";
import type { SnapshotCreatedEvent } from "../../domain/events/snapshot-created.event";
import {
  type INetWorthSnapshotRepository,
  NET_WORTH_SNAPSHOT_REPOSITORY,
} from "../../domain/repositories/net-worth-snapshot.repository.interface";
import {
  type IPortfolioSnapshotRepository,
  PORTFOLIO_SNAPSHOT_REPOSITORY,
} from "../../domain/repositories/portfolio-snapshot.repository.interface";

@Injectable()
export class SnapshotCreatedHandler {
  private readonly logger = new Logger(SnapshotCreatedHandler.name);

  constructor(
    @Inject(NET_WORTH_SNAPSHOT_REPOSITORY)
    private readonly netWorthSnapshotRepository: INetWorthSnapshotRepository,
    @Inject(PORTFOLIO_SNAPSHOT_REPOSITORY)
    private readonly portfolioSnapshotRepository: IPortfolioSnapshotRepository,
  ) {}

  @OnEvent("snapshot.created")
  async handle(event: SnapshotCreatedEvent): Promise<void> {
    try {
      if (event.type === "net_worth") {
        await this.handleNetWorthSnapshot(event);
      } else if (event.type === "portfolio") {
        await this.handlePortfolioSnapshot(event);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle snapshot.created event for user ${event.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private async handleNetWorthSnapshot(
    event: SnapshotCreatedEvent,
  ): Promise<void> {
    if (!event.totals || !event.breakdown) {
      throw new Error(
        "Invalid net worth snapshot event: missing totals or breakdown",
      );
    }

    const snapshot = new NetWorthSnapshot(
      randomUUID(),
      event.userId,
      event.snapshotDate,
      event.totals.assets,
      event.totals.liabilities,
      event.totals.netWorth,
      event.baseCurrency,
      {
        liquidity: event.breakdown.liquidity,
        investments: event.breakdown.investments,
        fixedAssets: event.breakdown.fixedAssets,
      },
      {
        revolving: event.breakdown.revolving,
        termLoans: event.breakdown.termLoans,
      },
      event.metadata?.fxRates ?? {},
      event.metadata?.fxRateDate ?? event.snapshotDate,
      event.metadata?.fxRateSource ?? null,
      new Date(),
      1,
    );

    await this.netWorthSnapshotRepository.create(snapshot);

    this.logger.log(
      `Net worth snapshot created for user ${event.userId} at ${event.snapshotDate.toISOString()}`,
    );
  }

  private async handlePortfolioSnapshot(
    event: SnapshotCreatedEvent,
  ): Promise<void> {
    if (!event.sourceId) {
      throw new Error("Invalid portfolio snapshot event: missing sourceId");
    }

    const snapshot = new PortfolioSnapshot(
      randomUUID(),
      event.sourceId,
      event.userId,
      event.snapshotDate,
      event.nav ?? 0,
      event.cash ?? 0,
      event.positions
        ? Object.fromEntries(
            event.positions.map((p, i) => [
              String(i),
              {
                instrumentId: p.instrumentId,
                quantity: p.quantity,
                averageCost: p.averageCost,
                side: p.side,
              },
            ]),
          )
        : null,
      new Date(),
      1,
    );

    await this.portfolioSnapshotRepository.create(snapshot);

    this.logger.log(
      `Portfolio snapshot created for portfolio ${event.sourceId} at ${event.snapshotDate.toISOString()}`,
    );
  }
}
