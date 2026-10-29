import type { AuditEvent } from "../entities/audit-event.entity";

export const AUDIT_EVENT_REPOSITORY = Symbol("AUDIT_EVENT_REPOSITORY");

/**
 * Where events are kept, stated without saying how.
 *
 * Two methods, because the trail has exactly two jobs: it is appended to and
 * its newest is read back. There is no update and no delete — an audit row that
 * can be changed is not evidence.
 */
export interface AuditEventRepository {
  append(event: AuditEvent): Promise<void>;
  /**
   * The newest `limit` events, newest first. The trail only ever grows, so the
   * bound is the interface's business rather than the caller's discipline.
   */
  listNewestFirst(limit: number): Promise<AuditEvent[]>;
}
