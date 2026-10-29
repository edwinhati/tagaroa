import { Inject, Injectable } from "@nestjs/common";

import type { AuditEvent } from "../../domain/entities/audit-event.entity";
import {
  AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
} from "../../domain/repositories/audit-event.repository";

/** The newest events, newest first. Read by the admin dashboard's timeline. */
@Injectable()
export class ListAuditEventsUseCase {
  constructor(
    @Inject(AUDIT_EVENT_REPOSITORY)
    private readonly events: AuditEventRepository,
  ) {}

  async execute(limit: number): Promise<AuditEvent[]> {
    return this.events.listNewestFirst(limit);
  }
}
