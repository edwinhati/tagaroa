import { Inject, Injectable } from "@nestjs/common";

import {
  AuditEvent,
  type RecordEventInput,
} from "../domain/entities/audit-event.entity";
import {
  AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
} from "../domain/repositories/audit-event.repository";

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
 * Every module that records or reads the trail depends on this interface and
 * on nothing else in this one — not its entities, its repository or its tables. That is what
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
    @Inject(AUDIT_EVENT_REPOSITORY)
    private readonly events: AuditEventRepository,
  ) {}

  /** `AuditEvent.record` owns the event's id and timestamp, not the caller. */
  async record(event: RecordEventInput): Promise<void> {
    await this.events.append(AuditEvent.record(event));
  }

  async recent(limit: number): Promise<RecordedEvent[]> {
    const events = await this.events.listNewestFirst(limit);

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
