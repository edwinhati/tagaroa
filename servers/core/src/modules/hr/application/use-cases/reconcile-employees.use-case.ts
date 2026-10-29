import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  EMPLOYEE_SOURCE,
  type EmployeeSource,
} from "../../domain/repositories/employee-source.port";
import { SyncEmployeeUseCase } from "./sync-employee.use-case";

/**
 * Every HR record, once. It catches what a webhook missed and the relieving
 * dates that have arrived since. One bad record is logged and skipped.
 */
@Injectable()
export class ReconcileEmployeesUseCase {
  private readonly logger = new Logger(ReconcileEmployeesUseCase.name);

  constructor(
    @Inject(EMPLOYEE_SOURCE) private readonly source: EmployeeSource,
    private readonly sync: SyncEmployeeUseCase,
  ) {}

  async execute(): Promise<void> {
    const tally = { failed: 0, issue: 0, none: 0, offboard: 0 };
    for (const employee of await this.source.employees()) {
      const action = await this.sync.execute(employee).catch(() => {
        this.logger.error(`Could not sync ${employee.name}`);
        return { kind: "failed" as const };
      });
      tally[action.kind] += 1;
    }
    // One line per pass, so a quiet log still shows the pass ran.
    this.logger.log(
      `Reconciled ${tally.issue + tally.offboard + tally.none + tally.failed} employees: ` +
        `${tally.issue} issued, ${tally.offboard} offboarded, ${tally.failed} failed`,
    );
  }
}
