import { Inject, Injectable } from "@nestjs/common";
import { type LinkedAccount } from "@repo/contracts/directory";
import { asc, count, eq, inArray } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../../../../platform/database/database.module";
import {
  account,
  user,
} from "../../../../auth/infrastructure/persistence/drizzle/schema";
import { type Person } from "../../../domain/entities/person.entity";
import { type PersonRepository } from "../../../domain/repositories/person.repository";
import { personMapper } from "./directory.mappers";

/**
 * People, read straight from the `auth` tables.
 *
 * The one place in `directory` that names Better Auth's schema for people. It
 * reads and never writes, so a regeneration of that schema can break this file
 * and nothing above it.
 */
@Injectable()
export class DrizzlePersonRepository implements PersonRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async listAll(): Promise<Person[]> {
    const rows = await this.database
      .select({
        banned: user.banned,
        createdAt: user.createdAt,
        email: user.email,
        emailVerified: user.emailVerified,
        id: user.id,
        mustChangePassword: user.mustChangePassword,
        name: user.name,
        role: user.role,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .orderBy(asc(user.name));

    return rows.map(personMapper.toDomain);
  }

  async displayNamesOf(userIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const rows = await this.database
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, unique));
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  async linkedAccountsOf(userId: string): Promise<LinkedAccount[]> {
    return this.database
      .select({
        accountId: account.accountId,
        createdAt: account.createdAt,
        id: account.id,
        providerId: account.providerId,
      })
      .from(account)
      .where(eq(account.userId, userId))
      .orderBy(asc(account.createdAt));
  }

  async personalEmailOf(userId: string): Promise<string | null> {
    const [row] = await this.database
      .select({ personalEmail: user.personalEmail })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    return row?.personalEmail ?? null;
  }

  async countLinkedAccounts(): Promise<number> {
    const [row] = await this.database.select({ value: count() }).from(account);
    return row?.value ?? 0;
  }
}
