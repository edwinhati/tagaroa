import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";

import { DrainQueueUseCase } from "../../application/use-cases/drain-queue.use-case";
import {
  DISPATCH_OPTIONS,
  type DispatchOptions,
} from "../config/notification.options";

/**
 * The timer, and only the timer.
 *
 * What a pass does is `DrainQueueUseCase`; when a pass happens is here, because
 * running on an interval is a fact about this deployment rather than about
 * sending. `NOTIFICATION_WORKER=0` turns it off, so moving the dispatcher into
 * its own process means a second entrypoint calling the same use case, not a
 * rewrite — and `for update skip locked` already makes two of them safe.
 */
@Injectable()
export class NotificationDispatcher
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationDispatcher.name);
  private timer?: ReturnType<typeof setInterval>;
  private draining = false;

  constructor(
    private readonly drainQueue: DrainQueueUseCase,
    @Inject(DISPATCH_OPTIONS) private readonly options: DispatchOptions,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.options.worker) {
      this.logger.log("Dispatcher disabled; nothing will be sent");
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, this.options.pollMilliseconds);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass. Overlapping passes are skipped rather than queued up. */
  async tick(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      await this.drainQueue.execute();
    } catch {
      this.logger.error(
        "Dispatcher pass failed; inspect notification state and provider health",
      );
    } finally {
      this.draining = false;
    }
  }
}
