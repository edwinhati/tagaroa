import { AuditEvent } from "../../../domain/entities/audit-event.entity";
import type { authAuditEvent } from "./schema";

type Row = typeof authAuditEvent.$inferSelect;
type Insert = typeof authAuditEvent.$inferInsert;

/**
 * Between the row and the entity.
 *
 * `createdAt` travels one way only: the column stamps it, so an insert never
 * carries one and a read always does.
 */
export const auditEventMapper = {
  toDomain: (row: Row): AuditEvent =>
    AuditEvent.restore({
      actorId: row.actorId,
      createdAt: row.createdAt,
      detail: row.detail,
      id: row.id,
      targetUserId: row.targetUserId,
      type: row.type,
    }),

  toPersistence: (event: AuditEvent): Insert => ({
    actorId: event.actorId,
    detail: event.detail,
    id: event.id,
    targetUserId: event.targetUserId,
    type: event.type,
  }),
};
