import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../../../../platform/database/database.module";
import {
  member,
  team,
  teamMember,
} from "../../../../auth/infrastructure/persistence/drizzle/schema";
import type { DomainAccessRepository } from "../../../domain/repositories/domain-access.repository";
import { teamDomain } from "./schema";

@Injectable()
export class DrizzleDomainAccessRepository implements DomainAccessRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}
  list() {
    return this.database.select().from(teamDomain);
  }
  mine(userId: string) {
    return this.database
      .select({
        teamId: teamDomain.teamId,
        domainSlug: teamDomain.domainSlug,
        organizationId: team.organizationId,
      })
      .from(teamDomain)
      .innerJoin(team, eq(team.id, teamDomain.teamId))
      .innerJoin(
        teamMember,
        and(eq(teamMember.teamId, team.id), eq(teamMember.userId, userId)),
      )
      .innerJoin(
        member,
        and(
          eq(member.organizationId, team.organizationId),
          eq(member.userId, userId),
        ),
      );
  }
  async bind(teamId: string, domainSlug: string | null): Promise<void> {
    if (domainSlug === null) {
      await this.database
        .delete(teamDomain)
        .where(eq(teamDomain.teamId, teamId));
      return;
    }
    await this.database
      .insert(teamDomain)
      .values({ teamId, domainSlug })
      .onConflictDoUpdate({ target: teamDomain.teamId, set: { domainSlug } });
  }
}
