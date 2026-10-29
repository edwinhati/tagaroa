import { Inject, Injectable } from "@nestjs/common";
import { asc, count, inArray } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../../../../platform/database/database.module";
import {
  member,
  organization,
  team,
  teamMember,
} from "../../../../auth/infrastructure/persistence/drizzle/schema";
import type {
  Subsidiary,
  Team,
} from "../../../domain/entities/subsidiary.entity";
import type { SubsidiaryRepository } from "../../../domain/repositories/subsidiary.repository";
import { subsidiaryMapper, teamMapper } from "./directory.mappers";

/** Rows keyed by team, from a flat join result. */
const byTeam = (rows: { teamId: string; userId: string }[]) => {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const existing = grouped.get(row.teamId);
    if (existing) existing.push(row.userId);
    else grouped.set(row.teamId, [row.userId]);
  }
  return grouped;
};

@Injectable()
export class DrizzleSubsidiaryRepository implements SubsidiaryRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async listSubsidiaries(): Promise<Subsidiary[]> {
    const rows = await this.database
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      })
      .from(organization)
      .orderBy(asc(organization.name));

    return rows.map(subsidiaryMapper.toDomain);
  }

  async listTeams(): Promise<Team[]> {
    const rows = await this.database
      .select({
        id: team.id,
        name: team.name,
        organizationId: team.organizationId,
      })
      .from(team)
      .orderBy(asc(team.name));

    if (rows.length === 0) return [];

    // One query for every team's members rather than one per team.
    const memberships = await this.database
      .select({ teamId: teamMember.teamId, userId: teamMember.userId })
      .from(teamMember)
      .where(
        inArray(
          teamMember.teamId,
          rows.map((row) => row.id),
        ),
      );

    const members = byTeam(memberships);
    return rows.map((row) =>
      teamMapper.toDomain(row, members.get(row.id) ?? []),
    );
  }

  async memberIdsBySubsidiary(): Promise<Map<string, string[]>> {
    const rows = await this.database
      .select({ organizationId: member.organizationId, userId: member.userId })
      .from(member);
    const grouped = new Map<string, string[]>();
    for (const row of rows) {
      const existing = grouped.get(row.organizationId);
      if (existing) existing.push(row.userId);
      else grouped.set(row.organizationId, [row.userId]);
    }
    return grouped;
  }

  async membershipUserIds(): Promise<Set<string>> {
    const rows = await this.database
      .select({ userId: teamMember.userId })
      .from(teamMember);

    return new Set(rows.map((row) => row.userId));
  }

  async countSubsidiaries(): Promise<number> {
    const [row] = await this.database
      .select({ value: count() })
      .from(organization);
    return row?.value ?? 0;
  }
}
