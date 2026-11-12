import {
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";

/**
 * Work a module runs on a timer in this process. Overlapping passes are
 * skipped rather than queued up, and a failed pass is logged as one sentence
 * and waited out until the next one.
 *
 * Shutdown stops the timer, then waits for a pass already under way:
 * `@nestjs/drizzle` closes the pool in `onApplicationShutdown`, which Nest runs
 * only once every `onModuleDestroy` has settled, so a pass is never cut off
 * halfway through a write.
 */
export abstract class IntervalJob
  implements OnApplicationBootstrap, OnModuleDestroy
{
  protected readonly logger = new Logger(this.constructor.name);
  private timer?: ReturnType<typeof setInterval>;
  private pass?: Promise<void>;

  /** How often to run, and whether to run once at startup; `null` is off. */
  protected abstract schedule(): {
    everyMs: number;
    atStartup: boolean;
  } | null;

  /** One pass. */
  protected abstract run(): Promise<void>;

  /** What a failed pass means to whoever reads the log. */
  protected abstract readonly failure: string;

  onApplicationBootstrap(): void {
    const schedule = this.schedule();
    if (!schedule) return;
    if (schedule.atStartup) void this.tick();
    this.timer = setInterval(() => void this.tick(), schedule.everyMs);
    this.timer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.idle();
  }

  /** Resolves once the pass under way, if any, has finished. */
  async idle(): Promise<void> {
    await this.pass;
  }

  async tick(): Promise<void> {
    if (this.pass) return;
    // Only the sentence is logged: a database or provider error can echo the
    // rows and credentials a pass was handling.
    this.pass = this.run()
      .catch(() => this.logger.error(this.failure))
      .finally(() => {
        this.pass = undefined;
      });
    await this.pass;
  }
}
