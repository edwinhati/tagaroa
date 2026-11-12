import { Module } from "@nestjs/common";

import { AUDIT_TRAIL, AuditTrailFacade } from "./application/audit.facade";
import { AUDIT_EVENT_REPOSITORY } from "./domain/repositories/audit-event.repository";
import { DrizzleAuditEventRepository } from "./infrastructure/persistence/drizzle/drizzle-audit-event.repository";

/**
 * The one place audit events are written. It imports no module that records,
 * so they stay unaware of each other. Only `AUDIT_TRAIL` is exported, which is
 * what stops another module reaching past the contract into the tables.
 */
@Module({
  exports: [AUDIT_TRAIL],
  providers: [
    { provide: AUDIT_EVENT_REPOSITORY, useClass: DrizzleAuditEventRepository },
    { provide: AUDIT_TRAIL, useClass: AuditTrailFacade },
  ],
})
export class AuditModule {}
