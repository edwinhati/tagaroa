import { Inject, Injectable } from "@nestjs/common";
import { desc } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../../../../platform/database/database.module";
import type { AuditEvent } from "../../../domain/entities/audit-event.entity";
import type { AuditEventRepository } from "../../../domain/repositories/audit-event.repository";
import { auditEventMapper } from "./audit-event.mapper";
import { authAuditEvent } from "./schema";

/** The only place in the module that knows the trail is a Postgres table. */
@Injectable()
export class DrizzleAuditEventRepository implements AuditEventRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async append(event: AuditEvent): Promise<void> {
    await this.database
      .insert(authAuditEvent)
      .values(auditEventMapper.toPersistence(event));
  }

  async listNewestFirst(limit: number): Promise<AuditEvent[]> {
    const rows = await this.database
      .select()
      .from(authAuditEvent)
      .orderBy(desc(authAuditEvent.createdAt))
      .limit(limit);

    return rows.map(auditEventMapper.toDomain);
  }
}
