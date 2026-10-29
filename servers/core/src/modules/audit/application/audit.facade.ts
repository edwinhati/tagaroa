import { Injectable } from "@nestjs/common";

import type { RecordEventInput } from "../domain/entities/audit-event.entity";
import { ListAuditEventsUseCase } from "./use-cases/list-audit-events.use-case";
import { RecordAuditEventUseCase } from "./use-cases/record-audit-event.use-case";

export const AUDIT_TRAIL = Symbol("AUDIT_TRAIL");

/** One event as another module reads it. Nothing here is an entity on purpose. */
export interface RecordedEvent {
  id: string;
  type: string;
  actorId: string | null;
  targetUserId: string | null;
  detail: string | null;
  createdAt: Date;
}

/**
 * The whole of what `audit` promises anyone outside it.
 *
 * `auth` and `directory` depend on this interface and on nothing else in the
 * module — not its entities, not its repository, not its tables. That is what
 * makes the trail movable: the day it becomes its own service, an HTTP client
 * is bound to `AUDIT_TRAIL` and no caller changes.
 *
 * It answers in plain data rather than in `AuditEvent`s for the same reason.
 * An entity handed across a module boundary is a shared model, and a shared
 * model is the thing that stops either side moving.
 */
export interface AuditTrail {
  record(event: RecordEventInput): Promise<void>;
  recent(limit: number): Promise<RecordedEvent[]>;
}

@Injectable()
export class AuditTrailFacade implements AuditTrail {
  constructor(
    private readonly recordEvent: RecordAuditEventUseCase,
    private readonly listEvents: ListAuditEventsUseCase,
  ) {}

  async record(event: RecordEventInput): Promise<void> {
    await this.recordEvent.execute(event);
  }

  async recent(limit: number): Promise<RecordedEvent[]> {
    const events = await this.listEvents.execute(limit);

    return events.map((event) => ({
      actorId: event.actorId,
      // Everything read back has been stamped; only an unwritten event has not.
      createdAt: event.createdAt ?? new Date(0),
      detail: event.detail,
      id: event.id,
      targetUserId: event.targetUserId,
      type: event.type,
    }));
  }
}
