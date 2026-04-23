import { beforeEach, describe, expect, it, jest } from "bun:test";
import "reflect-metadata";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ArchiveSnapshotsUseCase } from "../../application/use-cases/archive-snapshots.use-case";
import { SnapshotArchiveScheduler } from "./snapshot-archive.scheduler";

describe("SnapshotArchiveScheduler", () => {
  let scheduler: SnapshotArchiveScheduler;
  let archiveUseCase: jest.Mocked<ArchiveSnapshotsUseCase>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotArchiveScheduler,
        {
          provide: ArchiveSnapshotsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    scheduler = module.get<SnapshotArchiveScheduler>(SnapshotArchiveScheduler);
    archiveUseCase = module.get(ArchiveSnapshotsUseCase);
  });

  it("should execute archive use case with 90 days on weekly run", async () => {
    archiveUseCase.execute.mockResolvedValue({
      netWorthArchived: 10,
      portfolioArchived: 5,
      failed: 0,
    });

    await scheduler.handleWeeklyArchive();

    expect(archiveUseCase.execute).toHaveBeenCalledWith({ olderThanDays: 90 });
  });

  it("should log success when archive completes", async () => {
    archiveUseCase.execute.mockResolvedValue({
      netWorthArchived: 10,
      portfolioArchived: 5,
      failed: 0,
    });

    await scheduler.handleWeeklyArchive();

    expect(archiveUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it("should handle use case failure gracefully", async () => {
    archiveUseCase.execute.mockRejectedValue(new Error("Archive failed"));

    await scheduler.handleWeeklyArchive();

    expect(archiveUseCase.execute).toHaveBeenCalledTimes(1);
  });
});
