import { beforeEach, describe, expect, it, jest } from "bun:test";
import "reflect-metadata";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
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
import { ArchiveSnapshotsUseCase } from "./archive-snapshots.use-case";

const buildNetWorthSnapshot = (
  id: string,
  userId: string,
  date: string,
): NetWorthSnapshot =>
  new NetWorthSnapshot(
    id,
    userId,
    new Date(date),
    100000,
    20000,
    80000,
    "USD",
    { liquidity: 10000, investments: 60000, fixedAssets: 30000 },
    { revolving: 5000, termLoans: 15000 },
    { EUR: 0.92 },
    new Date(date),
    null,
    new Date(date),
    1,
  );

const buildPortfolioSnapshot = (
  id: string,
  portfolioId: string,
  userId: string,
  date: string,
): PortfolioSnapshot =>
  new PortfolioSnapshot(
    id,
    portfolioId,
    userId,
    new Date(date),
    150000,
    5000,
    {
      "0": {
        instrumentId: "AAPL",
        quantity: 100,
        averageCost: 175,
        side: "LONG",
      },
    },
    new Date(date),
    1,
  );

describe("ArchiveSnapshotsUseCase", () => {
  let useCase: ArchiveSnapshotsUseCase;
  let netWorthRepository: jest.Mocked<INetWorthSnapshotRepository>;
  let portfolioRepository: jest.Mocked<IPortfolioSnapshotRepository>;
  let storageService: jest.Mocked<IStorageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveSnapshotsUseCase,
        {
          provide: NET_WORTH_SNAPSHOT_REPOSITORY,
          useValue: {
            findUnarchivedBeforeDate: jest.fn(),
            markAsArchived: jest.fn(),
          },
        },
        {
          provide: PORTFOLIO_SNAPSHOT_REPOSITORY,
          useValue: {
            findUnarchivedBeforeDate: jest.fn(),
            markAsArchived: jest.fn(),
          },
        },
        {
          provide: STORAGE_SERVICE,
          useValue: {
            upload: jest.fn(),
            download: jest.fn(),
            getPresignedUrl: jest.fn(),
            delete: jest.fn(),
            getBucket: jest.fn().mockReturnValue("test-bucket"),
          },
        },
      ],
    }).compile();

    useCase = module.get<ArchiveSnapshotsUseCase>(ArchiveSnapshotsUseCase);
    netWorthRepository = module.get(NET_WORTH_SNAPSHOT_REPOSITORY);
    portfolioRepository = module.get(PORTFOLIO_SNAPSHOT_REPOSITORY);
    storageService = module.get(STORAGE_SERVICE);
  });

  it("should archive net worth and portfolio snapshots successfully", async () => {
    const oldDate = "2024-01-01";
    netWorthRepository.findUnarchivedBeforeDate.mockResolvedValue([
      buildNetWorthSnapshot("nw-1", "user-1", oldDate),
      buildNetWorthSnapshot("nw-2", "user-1", oldDate),
    ]);
    portfolioRepository.findUnarchivedBeforeDate.mockResolvedValue([
      buildPortfolioSnapshot("ps-1", "portfolio-1", "user-1", oldDate),
    ]);
    storageService.upload.mockResolvedValue(
      "https://s3.example.com/snapshots/net-worth/user-1/2024-01-01.json",
    );
    netWorthRepository.markAsArchived.mockResolvedValue(undefined);
    portfolioRepository.markAsArchived.mockResolvedValue(undefined);

    const result = await useCase.execute({ olderThanDays: 90 });

    expect(result.netWorthArchived).toBe(2);
    expect(result.portfolioArchived).toBe(1);
    expect(result.failed).toBe(0);
    expect(storageService.upload).toHaveBeenCalledTimes(2);
    expect(netWorthRepository.markAsArchived).toHaveBeenCalledWith(
      "nw-1",
      expect.any(String),
    );
    expect(netWorthRepository.markAsArchived).toHaveBeenCalledWith(
      "nw-2",
      expect.any(String),
    );
    expect(portfolioRepository.markAsArchived).toHaveBeenCalledWith(
      "ps-1",
      expect.any(String),
    );
  });

  it("should return zero counts when no snapshots to archive", async () => {
    netWorthRepository.findUnarchivedBeforeDate.mockResolvedValue([]);
    portfolioRepository.findUnarchivedBeforeDate.mockResolvedValue([]);

    const result = await useCase.execute({ olderThanDays: 90 });

    expect(result.netWorthArchived).toBe(0);
    expect(result.portfolioArchived).toBe(0);
    expect(result.failed).toBe(0);
    expect(storageService.upload).not.toHaveBeenCalled();
  });

  it("should handle S3 upload failure for net worth snapshots gracefully", async () => {
    const oldDate = "2024-01-01";
    netWorthRepository.findUnarchivedBeforeDate.mockResolvedValue([
      buildNetWorthSnapshot("nw-1", "user-1", oldDate),
    ]);
    portfolioRepository.findUnarchivedBeforeDate.mockResolvedValue([]);
    storageService.upload.mockRejectedValue(new Error("S3 upload failed"));

    const result = await useCase.execute({ olderThanDays: 90 });

    expect(result.netWorthArchived).toBe(0);
    expect(result.portfolioArchived).toBe(0);
    expect(result.failed).toBe(1);
    expect(netWorthRepository.markAsArchived).not.toHaveBeenCalled();
  });

  it("should group snapshots by user for net worth", async () => {
    const oldDate = "2024-01-01";
    netWorthRepository.findUnarchivedBeforeDate.mockResolvedValue([
      buildNetWorthSnapshot("nw-1", "user-1", oldDate),
      buildNetWorthSnapshot("nw-2", "user-2", oldDate),
    ]);
    portfolioRepository.findUnarchivedBeforeDate.mockResolvedValue([]);
    storageService.upload.mockResolvedValue("https://s3.example.com/test.json");
    netWorthRepository.markAsArchived.mockResolvedValue(undefined);

    const result = await useCase.execute({ olderThanDays: 90 });

    expect(result.netWorthArchived).toBe(2);
    expect(storageService.upload).toHaveBeenCalledTimes(2);
    expect(storageService.upload).toHaveBeenCalledWith(
      expect.stringContaining("snapshots/net-worth/user-1/"),
      expect.any(Buffer),
      "application/json",
    );
    expect(storageService.upload).toHaveBeenCalledWith(
      expect.stringContaining("snapshots/net-worth/user-2/"),
      expect.any(Buffer),
      "application/json",
    );
  });

  it("should group portfolio snapshots by portfolioId", async () => {
    const oldDate = "2024-01-01";
    netWorthRepository.findUnarchivedBeforeDate.mockResolvedValue([]);
    portfolioRepository.findUnarchivedBeforeDate.mockResolvedValue([
      buildPortfolioSnapshot("ps-1", "portfolio-1", "user-1", oldDate),
      buildPortfolioSnapshot("ps-2", "portfolio-2", "user-1", oldDate),
    ]);
    storageService.upload.mockResolvedValue("https://s3.example.com/test.json");
    portfolioRepository.markAsArchived.mockResolvedValue(undefined);

    const result = await useCase.execute({ olderThanDays: 90 });

    expect(result.portfolioArchived).toBe(2);
    expect(storageService.upload).toHaveBeenCalledTimes(2);
    expect(storageService.upload).toHaveBeenCalledWith(
      expect.stringContaining("snapshots/portfolio/portfolio-1/"),
      expect.any(Buffer),
      "application/json",
    );
    expect(storageService.upload).toHaveBeenCalledWith(
      expect.stringContaining("snapshots/portfolio/portfolio-2/"),
      expect.any(Buffer),
      "application/json",
    );
  });
});
