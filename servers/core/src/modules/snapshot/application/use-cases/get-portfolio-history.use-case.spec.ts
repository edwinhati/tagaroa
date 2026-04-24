import { beforeEach, describe, expect, it, jest } from "bun:test";
import "reflect-metadata";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { PortfolioSnapshot } from "../../domain/entities/portfolio-snapshot.entity";
import {
  type IPortfolioSnapshotRepository,
  PORTFOLIO_SNAPSHOT_REPOSITORY,
} from "../../domain/repositories/portfolio-snapshot.repository.interface";
import { GetPortfolioHistoryUseCase } from "./get-portfolio-history.use-case";

const buildPortfolioSnapshot = (
  id: string,
  portfolioId: string,
): PortfolioSnapshot =>
  new PortfolioSnapshot(
    id,
    portfolioId,
    "user-1",
    new Date("2024-01-01"),
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
    new Date(),
    1,
  );

describe("GetPortfolioHistoryUseCase", () => {
  let useCase: GetPortfolioHistoryUseCase;
  let snapshotRepository: jest.Mocked<IPortfolioSnapshotRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPortfolioHistoryUseCase,
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

    useCase = module.get<GetPortfolioHistoryUseCase>(
      GetPortfolioHistoryUseCase,
    );
    snapshotRepository = module.get(PORTFOLIO_SNAPSHOT_REPOSITORY);
  });

  it("should call findByPortfolioIdInRange with correct args and return result", async () => {
    const snapshots = [
      buildPortfolioSnapshot("snap-1", "portfolio-1"),
      buildPortfolioSnapshot("snap-2", "portfolio-1"),
    ];
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31");

    snapshotRepository.findByPortfolioIdInRange.mockResolvedValue(snapshots);

    const result = await useCase.execute({
      portfolioId: "portfolio-1",
      startDate,
      endDate,
    });

    expect(snapshotRepository.findByPortfolioIdInRange).toHaveBeenCalledWith(
      "portfolio-1",
      startDate,
      endDate,
    );
    expect(result).toEqual(snapshots);
  });

  it("should return empty array when repository returns empty array", async () => {
    snapshotRepository.findByPortfolioIdInRange.mockResolvedValue([]);

    const result = await useCase.execute({
      portfolioId: "portfolio-1",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
    });

    expect(result).toEqual([]);
    expect(snapshotRepository.findByPortfolioIdInRange).toHaveBeenCalled();
  });
});
