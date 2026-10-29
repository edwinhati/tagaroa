import { Inject, Injectable } from "@nestjs/common";

import {
  AuditEvent,
  type RecordEventInput,
} from "../../domain/entities/audit-event.entity";
import {
  AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
} from "../../domain/repositories/audit-event.repository";

/** AuditEvent.record owns the event ID and timestamp, not the caller. */
@Injectable()
export class RecordAuditEventUseCase {
  constructor(
    @Inject(AUDIT_EVENT_REPOSITORY)
    private readonly events: AuditEventRepository,
  ) {}

  async execute(input: RecordEventInput): Promise<void> {
    await this.events.append(AuditEvent.record(input));
  }
}
