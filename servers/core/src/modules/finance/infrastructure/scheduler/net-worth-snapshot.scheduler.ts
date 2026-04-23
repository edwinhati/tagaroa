import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CreateNetWorthSnapshotUseCase } from "../../application/use-cases/create-net-worth-snapshot.use-case";
import {
  ACCOUNT_REPOSITORY,
  type IAccountRepository,
} from "../../domain/repositories/account.repository.interface";

@Injectable()
export class NetWorthSnapshotScheduler {
  private readonly logger = new Logger(NetWorthSnapshotScheduler.name);

  constructor(
    private readonly createSnapshotUseCase: CreateNetWorthSnapshotUseCase,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async handleWeeklySnapshot(): Promise<void> {
    this.logger.log("Starting weekly net worth snapshot generation");

    const userIds = await this.accountRepository.findAllActiveUserIds();
    this.logger.log(
      `Found ${userIds.length} active user(s) for snapshot generation`,
    );

    let successCount = 0;
    let failureCount = 0;

    for (const userId of userIds) {
      try {
        await this.createSnapshotUseCase.execute({ userId });
        successCount++;
        this.logger.log(`Net worth snapshot created for user ${userId}`);
      } catch (error) {
        failureCount++;
        this.logger.error(
          `Failed to create net worth snapshot for user ${userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(
      `Weekly snapshot generation completed: ${successCount} succeeded, ${failureCount} failed out of ${userIds.length} total`,
    );
  }
}
