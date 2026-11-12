import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../../../platform/database/database.module";
import { IntervalJob } from "../../../../platform/scheduling/interval-job";
import { ReconcileEmployeesUseCase } from "../../application/use-cases/reconcile-employees.use-case";
import { HR_OPTIONS, type HrOptions } from "../config/hr.options";

/** A missed webhook is caught within the hour, and so is a relieving date. */
const RECONCILE_MS = 60 * 60_000;

/** Any constant no other advisory lock in this database uses. */
export const RECONCILE_LOCK = 4_701_260_001;

/**
 * Once at startup, then hourly; off while HR is unconfigured. Across replicas a
 * transaction-scoped advisory lock makes a pass one replica's at a time, and
 * the lock goes with its transaction even if the process dies mid-pass.
 */
@Injectable()
export class HrReconciler extends IntervalJob {
  protected readonly failure = "HR reconciliation failed; nothing was synced";

  constructor(
    private readonly reconcile: ReconcileEmployeesUseCase,
    @Inject(DATABASE) private readonly database: Database,
    @Inject(HR_OPTIONS) private readonly options: HrOptions,
  ) {
    super();
  }

  protected schedule() {
    return this.options ? { atStartup: true, everyMs: RECONCILE_MS } : null;
  }

  protected run(): Promise<void> {
    return this.database.transaction(async (tx) => {
      const [row] = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(${RECONCILE_LOCK}) as locked`,
      );
      if (row?.locked) await this.reconcile.execute();
    });
  }
}
