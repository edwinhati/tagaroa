import { Module } from "@nestjs/common";

import { AUDIT_TRAIL, AuditTrailFacade } from "./application/audit.facade";
import { ListAuditEventsUseCase } from "./application/use-cases/list-audit-events.use-case";
import { RecordAuditEventUseCase } from "./application/use-cases/record-audit-event.use-case";
import { AUDIT_EVENT_REPOSITORY } from "./domain/repositories/audit-event.repository";
import { DrizzleAuditEventRepository } from "./infrastructure/persistence/drizzle/drizzle-audit-event.repository";

/**
 * The one place identity events are written. Imported by `auth` and by
 * `directory`, which both record; it imports neither, so the two stay unaware
 * of each other.
 *
 * Only `AUDIT_TRAIL` is exported. The use cases and the repository are internal,
 * which is what stops another module reaching past the contract into the tables.
 */
@Module({
  exports: [AUDIT_TRAIL],
  providers: [
    ListAuditEventsUseCase,
    RecordAuditEventUseCase,
    { provide: AUDIT_EVENT_REPOSITORY, useClass: DrizzleAuditEventRepository },
    { provide: AUDIT_TRAIL, useClass: AuditTrailFacade },
  ],
})
export class AuditModule {}
