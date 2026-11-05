import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import { sql } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../../../platform/database/database.module";
import { ReconcileEmployeesUseCase } from "../../application/use-cases/reconcile-employees.use-case";
import { HR_OPTIONS, type HrOptions } from "../config/hr.options";

/** A missed webhook is caught within the hour, and so is a relieving date. */
const RECONCILE_MS = 60 * 60_000;

/** Any constant no other advisory lock in this database uses. */
export const RECONCILE_LOCK = 4_701_260_001;

/**
 * The timer, and only the timer: once at startup, then hourly. Off while HR is
 * unconfigured. Overlapping passes are skipped rather than queued up — within a
 * process by a flag, across replicas by a transaction-scoped advisory lock, so
 * a pass is one replica's at a time and the lock goes with its transaction even
 * if the process dies mid-pass.
 */
@Injectable()
export class HrReconciler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(HrReconciler.name);
  private timer?: ReturnType<typeof setInterval>;
  /** The pass under way, if any. */
  private pass?: Promise<void>;

  constructor(
    private readonly reconcile: ReconcileEmployeesUseCase,
    @Inject(DATABASE) private readonly database: Database,
    @Inject(HR_OPTIONS) private readonly options: HrOptions,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.options) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), RECONCILE_MS);
    this.timer.unref?.();
  }

  /**
   * Stops the timer, then waits for a pass already under way, so the pool that
   * `@nestjs/drizzle` closes after every `onModuleDestroy` has settled is not
   * pulled from under an open transaction halfway through issuing accounts.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.pass;
  }

  async tick(): Promise<void> {
    if (this.pass) return;
    this.pass = this.reconcileOnce().finally(() => {
      this.pass = undefined;
    });
    await this.pass;
  }

  private async reconcileOnce(): Promise<void> {
    try {
      await this.database.transaction(async (tx) => {
        const [row] = await tx.execute<{ locked: boolean }>(
          sql`select pg_try_advisory_xact_lock(${RECONCILE_LOCK}) as locked`,
        );
        if (row?.locked) await this.reconcile.execute();
      });
    } catch {
      this.logger.error("Frappe HR could not be read; nothing was synced");
    }
  }
}
