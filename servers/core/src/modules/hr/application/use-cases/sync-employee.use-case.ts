import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  ACCOUNT_LIFECYCLE,
  type AccountLifecycle,
  type AccountState,
} from "../../../auth/account-lifecycle.facade";
import { type Action, decide, type Employee } from "../../domain/employee";
import {
  EMPLOYEE_LINKS,
  type EmployeeLinkRepository,
} from "../../domain/repositories/employee-link.repository";
import {
  EMPLOYEE_SOURCE,
  type EmployeeSource,
} from "../../domain/repositories/employee-source.port";

const SOURCE = "Frappe HR";
const CONFLICT = "Its company email belongs to another record's account";
const PRIVILEGED =
  "Its account is privileged; a super-admin offboards it by hand";

/**
 * Brings one account in step with one HR record: a joiner is issued an account,
 * a leaver is offboarded on their relieving date, and anything else is left
 * alone.
 *
 * The account is found through the link first. Without one, an account already
 * holding the company email is adopted and linked — that is how accounts issued
 * by hand before HR existed are taken over — unless it is linked to a different
 * record, which is reported rather than guessed at. A privileged account is
 * never adopted or retired: whoever can edit HR is not vetted to remove an
 * administrator, so that stays a super-admin's act.
 *
 * Calls take turns. A webhook and the hourly pass can name the same joiner at
 * once, and two issues of one address would fail on the second.
 * ponytail: turns are per process. Run the pass in one replica, or take an
 * advisory lock, before the core service scales out.
 */
@Injectable()
export class SyncEmployeeUseCase {
  private readonly logger = new Logger(SyncEmployeeUseCase.name);
  private turn: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(EMPLOYEE_SOURCE) private readonly source: EmployeeSource,
    @Inject(EMPLOYEE_LINKS) private readonly links: EmployeeLinkRepository,
    @Inject(ACCOUNT_LIFECYCLE) private readonly accounts: AccountLifecycle,
  ) {}

  /**
   * `today` is a UTC date. ponytail: a relieving date applies up to a day early
   * or late for staff far from UTC; keep a timezone per subsidiary if it matters.
   */
  execute(
    employee: Employee | string,
    today = new Date().toISOString().slice(0, 10),
  ): Promise<Action> {
    const run = this.turn.then(() => this.apply(employee, today));
    this.turn = run.catch(() => undefined);
    return run;
  }

  /**
   * A name is what a webhook carries. The record is re-read from the source,
   * so a forged or replayed webhook can only cause a re-read.
   */
  private async apply(
    named: Employee | string,
    today: string,
  ): Promise<Action> {
    const employee =
      typeof named === "string" ? await this.source.employee(named) : named;
    if (!employee) return { kind: "none" };
    const found = await this.account(employee);
    if (typeof found === "string") return this.skip(employee, found);
    const action = decide(employee, found, today);
    if (action.kind === "offboard" && found?.privileged)
      return this.skip(employee, PRIVILEGED);

    if (action.kind === "none" && action.reason)
      this.logger.log(`${employee.name}: ${action.reason}`);
    if (action.kind === "offboard" && found)
      await this.accounts.retire(
        found.id,
        `Left per ${SOURCE} ${employee.name}` +
          (employee.relievingDate
            ? `, relieved ${employee.relievingDate}`
            : ""),
      );
    if (action.kind === "issue") await this.issue(employee);
    return action;
  }

  private skip(employee: Employee, reason: string): Action {
    this.logger.log(`${employee.name}: ${reason}`);
    return { kind: "none", reason };
  }

  /** The account for the record, or why none may be taken. */
  private async account(
    employee: Employee,
  ): Promise<AccountState | null | string> {
    const linked = await this.links.accountFor(employee.name);
    if (linked) return this.accounts.byId(linked);
    if (!employee.companyEmail) return null;

    const holder = await this.accounts.byEmail(employee.companyEmail);
    if (!holder) return null;
    const owner = await this.links.employeeFor(holder.id);
    if (owner) return owner === employee.name ? holder : CONFLICT;
    if (holder.privileged) return PRIVILEGED;
    await this.links.link(employee.name, holder.id);
    return holder;
  }

  private async issue(employee: Employee): Promise<void> {
    const email = employee.companyEmail!;
    const issued = await this.accounts.issue({
      email,
      name: employee.displayName ?? email,
      personalEmail: employee.personalEmail!,
      source: `${SOURCE} ${employee.name}`,
    });
    // If this fails the account still exists; the next pass adopts it by email.
    await this.links.link(employee.name, issued.id);
    if (!issued.onboardingQueued)
      this.logger.warn(
        `${employee.name}: account issued but onboarding was not queued; reissue the password`,
      );
  }
}
