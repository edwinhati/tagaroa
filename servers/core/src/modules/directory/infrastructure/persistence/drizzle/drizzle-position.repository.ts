import { Inject, Injectable } from "@nestjs/common";
import { type PositionRecord } from "@repo/contracts/directory";
import { and, asc, eq } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../../../../platform/database/database.module";
import { type PositionRepository } from "../../../domain/repositories/position.repository";
import { personPosition } from "./schema";

const scopeKey = (organizationId: string | null): string =>
  organizationId ?? "group";

@Injectable()
export class DrizzlePositionRepository implements PositionRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  list(): Promise<PositionRecord[]> {
    return this.database
      .select({
        id: personPosition.id,
        managerUserId: personPosition.managerUserId,
        organizationId: personPosition.organizationId,
        title: personPosition.title,
        updatedAt: personPosition.updatedAt,
        updatedBy: personPosition.updatedBy,
        userId: personPosition.userId,
      })
      .from(personPosition)
      .orderBy(asc(personPosition.title));
  }

  listForUser(userId: string): Promise<PositionRecord[]> {
    return this.database
      .select({
        id: personPosition.id,
        managerUserId: personPosition.managerUserId,
        organizationId: personPosition.organizationId,
        title: personPosition.title,
        updatedAt: personPosition.updatedAt,
        updatedBy: personPosition.updatedBy,
        userId: personPosition.userId,
      })
      .from(personPosition)
      .where(eq(personPosition.userId, userId))
      .orderBy(asc(personPosition.title));
  }

  async save(input: {
    actorId: string;
    id: string;
    managerUserId: string | null;
    organizationId: string | null;
    title: string;
    userId: string;
  }): Promise<PositionRecord> {
    const [row] = await this.database
      .insert(personPosition)
      .values({
        createdBy: input.actorId,
        id: input.id,
        managerUserId: input.managerUserId,
        organizationId: input.organizationId,
        scopeKey: scopeKey(input.organizationId),
        title: input.title,
        updatedBy: input.actorId,
        userId: input.userId,
      })
      .onConflictDoUpdate({
        set: {
          managerUserId: input.managerUserId,
          title: input.title,
          updatedAt: new Date(),
          updatedBy: input.actorId,
        },
        target: [personPosition.userId, personPosition.scopeKey],
      })
      .returning({
        id: personPosition.id,
        managerUserId: personPosition.managerUserId,
        organizationId: personPosition.organizationId,
        title: personPosition.title,
        updatedAt: personPosition.updatedAt,
        updatedBy: personPosition.updatedBy,
        userId: personPosition.userId,
      });
    if (!row) throw new Error("Position write did not return a row");
    return row;
  }

  async remove(
    userId: string,
    organizationId: string | null,
  ): Promise<boolean> {
    const rows = await this.database
      .delete(personPosition)
      .where(
        and(
          eq(personPosition.userId, userId),
          eq(personPosition.scopeKey, scopeKey(organizationId)),
        ),
      )
      .returning({ id: personPosition.id });
    return rows.length > 0;
  }
}
