import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../../../../platform/database/database.module";
import type { EmployeeLinkRepository } from "../../../domain/repositories/employee-link.repository";
import { employeeAccount } from "./schema";

@Injectable()
export class DrizzleEmployeeLinkRepository implements EmployeeLinkRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async accountFor(employee: string): Promise<string | null> {
    const [row] = await this.database
      .select({ userId: employeeAccount.userId })
      .from(employeeAccount)
      .where(eq(employeeAccount.employee, employee));
    return row?.userId ?? null;
  }

  async employeeFor(accountId: string): Promise<string | null> {
    const [row] = await this.database
      .select({ employee: employeeAccount.employee })
      .from(employeeAccount)
      .where(eq(employeeAccount.userId, accountId));
    return row?.employee ?? null;
  }

  async link(employee: string, accountId: string): Promise<void> {
    await this.database
      .insert(employeeAccount)
      .values({ employee, userId: accountId });
  }
}
