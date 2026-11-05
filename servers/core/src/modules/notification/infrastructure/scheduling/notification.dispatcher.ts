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
  /** The pass under way, if any. */
  private pass?: Promise<void>;

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

  /**
   * Stops the timer, then waits for a pass already under way. `@nestjs/drizzle`
   * closes the pool in `onApplicationShutdown`, which Nest runs only once every
   * `onModuleDestroy` has settled. A pass cut off by that close has handed a
   * message to a provider but cannot mark it sent, so the claim is reclaimed
   * later and the message goes out twice.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.pass;
  }

  /** One pass. Overlapping passes are skipped rather than queued up. */
  async tick(): Promise<void> {
    if (this.pass) return;
    this.pass = this.drain().finally(() => {
      this.pass = undefined;
    });
    await this.pass;
  }

  private async drain(): Promise<void> {
    try {
      await this.drainQueue.execute();
    } catch {
      this.logger.error(
        "Dispatcher pass failed; inspect notification state and provider health",
      );
    }
  }
}
