import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ArchiveSnapshotsUseCase } from "../../application/use-cases/archive-snapshots.use-case";

@Injectable()
export class SnapshotArchiveScheduler {
  private readonly logger = new Logger(SnapshotArchiveScheduler.name);

  constructor(private readonly archiveUseCase: ArchiveSnapshotsUseCase) {}

  @Cron(CronExpression.EVERY_WEEK)
  async handleWeeklyArchive(): Promise<void> {
    this.logger.log("Starting weekly snapshot archive job");

    try {
      const result = await this.archiveUseCase.execute({ olderThanDays: 90 });
      this.logger.log(
        `Weekly archive completed: ${result.netWorthArchived} net worth, ${result.portfolioArchived} portfolio snapshots archived. ${result.failed} failed.`,
      );
    } catch (error) {
      this.logger.error(
        "Weekly snapshot archive job failed",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
