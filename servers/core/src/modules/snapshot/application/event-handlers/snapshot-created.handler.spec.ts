import { beforeEach, describe, expect, it, jest } from "bun:test";
import "reflect-metadata";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
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
import { SnapshotCreatedHandler } from "./snapshot-created.handler";

describe("SnapshotCreatedHandler", () => {
  let handler: SnapshotCreatedHandler;
  let netWorthSnapshotRepository: jest.Mocked<INetWorthSnapshotRepository>;
  let portfolioSnapshotRepository: jest.Mocked<IPortfolioSnapshotRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotCreatedHandler,
        {
          provide: NET_WORTH_SNAPSHOT_REPOSITORY,
          useValue: {
            findByUserId: jest.fn(),
            findByUserIdAndDateRange: jest.fn(),
            findLatestByUserId: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: PORTFOLIO_SNAPSHOT_REPOSITORY,
          useValue: {
            findByPortfolioId: jest.fn(),
            findByPortfolioIdInRange: jest.fn(),
            findLatest: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<SnapshotCreatedHandler>(SnapshotCreatedHandler);
    netWorthSnapshotRepository = module.get(NET_WORTH_SNAPSHOT_REPOSITORY);
    portfolioSnapshotRepository = module.get(PORTFOLIO_SNAPSHOT_REPOSITORY);
  });

  it("should create net worth snapshot when type is net_worth", async () => {
    const event: SnapshotCreatedEvent = {
      type: "net_worth",
      userId: "user-1",
      snapshotDate: new Date("2024-01-15"),
      baseCurrency: "USD",
      totals: { assets: 100000, liabilities: 20000, netWorth: 80000 },
      breakdown: {
        liquidity: 10000,
        investments: 60000,
        fixedAssets: 30000,
        revolving: 5000,
        termLoans: 15000,
      },
      metadata: {
        fxRates: { EUR: 0.92 },
        fxRateDate: new Date("2024-01-15"),
        fxRateSource: "ECB",
      },
    };

    netWorthSnapshotRepository.create.mockResolvedValue({} as NetWorthSnapshot);

    await handler.handle(event);

    expect(netWorthSnapshotRepository.create).toHaveBeenCalled();
    const createdSnapshot = netWorthSnapshotRepository.create.mock.calls[0][0];
    expect(createdSnapshot).toBeInstanceOf(NetWorthSnapshot);
    expect(createdSnapshot.userId).toBe("user-1");
    expect(createdSnapshot.totalAssets).toBe(100000);
    expect(createdSnapshot.totalLiabilities).toBe(20000);
    expect(createdSnapshot.netWorth).toBe(80000);
    expect(createdSnapshot.baseCurrency).toBe("USD");
  });

  it("should create portfolio snapshot when type is portfolio", async () => {
    const event: SnapshotCreatedEvent = {
      type: "portfolio",
      userId: "user-1",
      sourceId: "portfolio-1",
      snapshotDate: new Date("2024-01-15"),
      baseCurrency: "USD",
      nav: 150000,
      cash: 5000,
      positions: [
        {
          instrumentId: "AAPL",
          quantity: 100,
          averageCost: 175,
          side: "LONG",
        },
      ],
    };

    portfolioSnapshotRepository.create.mockResolvedValue(
      {} as PortfolioSnapshot,
    );

    await handler.handle(event);

    expect(portfolioSnapshotRepository.create).toHaveBeenCalled();
    const createdSnapshot = portfolioSnapshotRepository.create.mock.calls[0][0];
    expect(createdSnapshot).toBeInstanceOf(PortfolioSnapshot);
    expect(createdSnapshot.portfolioId).toBe("portfolio-1");
    expect(createdSnapshot.userId).toBe("user-1");
    expect(createdSnapshot.nav).toBe(150000);
    expect(createdSnapshot.cash).toBe(5000);
  });

  it("should throw error when net worth event missing totals", async () => {
    const event: SnapshotCreatedEvent = {
      type: "net_worth",
      userId: "user-1",
      snapshotDate: new Date("2024-01-15"),
      baseCurrency: "USD",
      breakdown: {
        liquidity: 10000,
        investments: 60000,
        fixedAssets: 30000,
        revolving: 5000,
        termLoans: 15000,
      },
    };

    await expect(handler.handle(event)).rejects.toThrow(
      "Invalid net worth snapshot event: missing totals or breakdown",
    );
  });

  it("should throw error when net worth event missing breakdown", async () => {
    const event: SnapshotCreatedEvent = {
      type: "net_worth",
      userId: "user-1",
      snapshotDate: new Date("2024-01-15"),
      baseCurrency: "USD",
      totals: { assets: 100000, liabilities: 20000, netWorth: 80000 },
    };

    await expect(handler.handle(event)).rejects.toThrow(
      "Invalid net worth snapshot event: missing totals or breakdown",
    );
  });

  it("should throw error when portfolio event missing sourceId", async () => {
    const event: SnapshotCreatedEvent = {
      type: "portfolio",
      userId: "user-1",
      snapshotDate: new Date("2024-01-15"),
      baseCurrency: "USD",
      nav: 150000,
      cash: 5000,
    };

    await expect(handler.handle(event)).rejects.toThrow(
      "Invalid portfolio snapshot event: missing sourceId",
    );
  });

  it("should re-throw error when repository throws", async () => {
    const event: SnapshotCreatedEvent = {
      type: "net_worth",
      userId: "user-1",
      snapshotDate: new Date("2024-01-15"),
      baseCurrency: "USD",
      totals: { assets: 100000, liabilities: 20000, netWorth: 80000 },
      breakdown: {
        liquidity: 10000,
        investments: 60000,
        fixedAssets: 30000,
        revolving: 5000,
        termLoans: 15000,
      },
    };

    const error = new Error("Database connection failed");
    netWorthSnapshotRepository.create.mockRejectedValue(error);

    await expect(handler.handle(event)).rejects.toThrow(
      "Database connection failed",
    );
  });
});
