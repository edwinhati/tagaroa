import { Inject, Injectable } from "@nestjs/common";
import { count, desc, gt, max } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../../../../platform/database/database.module";
import { session } from "../../../../auth/infrastructure/persistence/drizzle/schema";
import type {
  PersonActivity,
  SessionRepository,
} from "../../../domain/repositories/session.repository";
import type { SignIn } from "../../../domain/services/timeline.service";

@Injectable()
export class DrizzleSessionRepository implements SessionRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async activityAt(now: Date): Promise<PersonActivity[]> {
    return this.database
      .select({
        activeSessions: count(),
        lastActiveAt: max(session.updatedAt),
        userId: session.userId,
      })
      .from(session)
      .where(gt(session.expiresAt, now))
      .groupBy(session.userId);
  }

  async listSignIns(limit: number): Promise<SignIn[]> {
    return this.database
      .select({
        at: session.createdAt,
        id: session.id,
        ipAddress: session.ipAddress,
        userId: session.userId,
      })
      .from(session)
      .orderBy(desc(session.createdAt))
      .limit(limit);
  }
}
