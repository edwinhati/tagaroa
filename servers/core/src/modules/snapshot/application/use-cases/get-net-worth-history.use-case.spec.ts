import { beforeEach, describe, expect, it, jest } from "bun:test";
import "reflect-metadata";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { NetWorthSnapshot } from "../../domain/entities/net-worth-snapshot.entity";
import {
  type INetWorthSnapshotRepository,
  NET_WORTH_SNAPSHOT_REPOSITORY,
} from "../../domain/repositories/net-worth-snapshot.repository.interface";
import { GetNetWorthHistoryUseCase } from "./get-net-worth-history.use-case";

const buildNetWorthSnapshot = (id: string, userId: string): NetWorthSnapshot =>
  new NetWorthSnapshot(
    id,
    userId,
    new Date("2024-01-01"),
    100000,
    20000,
    80000,
    "USD",
    { liquidity: 10000, investments: 60000, fixedAssets: 30000 },
    { revolving: 5000, termLoans: 15000 },
    { EUR: 0.92 },
    new Date("2024-01-01"),
    null,
    new Date(),
    1,
  );

describe("GetNetWorthHistoryUseCase", () => {
  let useCase: GetNetWorthHistoryUseCase;
  let snapshotRepository: jest.Mocked<INetWorthSnapshotRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetNetWorthHistoryUseCase,
        {
          provide: NET_WORTH_SNAPSHOT_REPOSITORY,
          useValue: {
            findByUserId: jest.fn(),
            findByUserIdAndDateRange: jest.fn(),
            findLatestByUserId: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetNetWorthHistoryUseCase>(GetNetWorthHistoryUseCase);
    snapshotRepository = module.get(NET_WORTH_SNAPSHOT_REPOSITORY);
  });

  it("should call findByUserIdAndDateRange with correct args and return result", async () => {
    const snapshots = [
      buildNetWorthSnapshot("snap-1", "user-1"),
      buildNetWorthSnapshot("snap-2", "user-1"),
    ];
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31");

    snapshotRepository.findByUserIdAndDateRange.mockResolvedValue(snapshots);

    const result = await useCase.execute({
      userId: "user-1",
      startDate,
      endDate,
    });

    expect(snapshotRepository.findByUserIdAndDateRange).toHaveBeenCalledWith(
      "user-1",
      startDate,
      endDate,
    );
    expect(result).toEqual(snapshots);
  });

  it("should return empty array when repository returns empty array", async () => {
    snapshotRepository.findByUserIdAndDateRange.mockResolvedValue([]);

    const result = await useCase.execute({
      userId: "user-1",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
    });

    expect(result).toEqual([]);
    expect(snapshotRepository.findByUserIdAndDateRange).toHaveBeenCalled();
  });
});
