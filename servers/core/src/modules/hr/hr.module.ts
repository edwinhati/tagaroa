import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { AppEnv } from "../../platform/config/env";
import { AuthModule } from "../auth/auth.module";
import { ReconcileEmployeesUseCase } from "./application/use-cases/reconcile-employees.use-case";
import { SyncEmployeeUseCase } from "./application/use-cases/sync-employee.use-case";
import { EMPLOYEE_LINKS } from "./domain/repositories/employee-link.repository";
import {
  EMPLOYEE_SOURCE,
  type EmployeeSource,
} from "./domain/repositories/employee-source.port";
import { HR_OPTIONS, type HrOptions } from "./infrastructure/config/hr.options";
import { frappeEmployees } from "./infrastructure/frappe/frappe";
import { DrizzleEmployeeLinkRepository } from "./infrastructure/persistence/drizzle/drizzle-employee-link.repository";
import { HrReconciler } from "./infrastructure/scheduling/hr.reconciler";
import { HrWebhookController } from "./presentation/hr-webhook.controller";

const unconfigured: EmployeeSource = {
  employee: () => Promise.reject(new Error("Frappe HR is not configured")),
  employees: () => Promise.reject(new Error("Frappe HR is not configured")),
};

/**
 * HR records → accounts. Inert until the four `FRAPPE_*` settings are set.
 * It exports nothing; it drives `auth` through `ACCOUNT_LIFECYCLE` alone.
 */
@Module({
  controllers: [HrWebhookController],
  imports: [AuthModule],
  providers: [
    SyncEmployeeUseCase,
    ReconcileEmployeesUseCase,
    HrReconciler,
    { provide: EMPLOYEE_LINKS, useClass: DrizzleEmployeeLinkRepository },
    {
      inject: [ConfigService],
      provide: HR_OPTIONS,
      useFactory: (config: ConfigService<AppEnv, true>): HrOptions => {
        const url = config.get("FRAPPE_URL", { infer: true });
        return url
          ? {
              apiKey: config.get("FRAPPE_API_KEY", { infer: true })!,
              apiSecret: config.get("FRAPPE_API_SECRET", { infer: true })!,
              url,
              webhookSecret: config.get("FRAPPE_WEBHOOK_SECRET", {
                infer: true,
              })!,
            }
          : null;
      },
    },
    {
      inject: [HR_OPTIONS],
      provide: EMPLOYEE_SOURCE,
      useFactory: (options: HrOptions): EmployeeSource =>
        options ? frappeEmployees(options) : unconfigured,
    },
  ],
})
export class HrModule {}
