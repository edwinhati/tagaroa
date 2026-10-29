import { Inject, Injectable } from "@nestjs/common";

import {
  POSITION_REPOSITORY,
  type PositionRepository,
} from "../../domain/repositories/position.repository";
import {
  SUBSIDIARY_REPOSITORY,
  type SubsidiaryRepository,
} from "../../domain/repositories/subsidiary.repository";
import type { GroupSnapshot } from "../dto/group-snapshot.dto";

/**
 * The whole group, for whoever administers it.
 *
 * Better Auth's organization plugin answers as the signed-in member:
 * `/organization/list` returns only the subsidiaries they belong to, and
 * `/organization/list-team-members` refuses a caller who is not in the team
 * (`USER_IS_NOT_A_MEMBER_OF_THE_TEAM`). That is right for the workspace and
 * wrong for an admin, whose whole job is the teams they are not in — and the
 * alternative, making an admin a member of every team, would also put every
 * domain on their own workspace rule.
 *
 * So the repositories read those tables directly. Nothing here writes at all.
 */
@Injectable()
export class GetGroupDirectoryUseCase {
  constructor(
    @Inject(SUBSIDIARY_REPOSITORY)
    private readonly subsidiaries: SubsidiaryRepository,
    @Inject(POSITION_REPOSITORY)
    private readonly positions: PositionRepository,
  ) {}

  async execute(): Promise<GroupSnapshot> {
    const [subsidiaries, teams, memberIds, positions] = await Promise.all([
      this.subsidiaries.listSubsidiaries(),
      this.subsidiaries.listTeams(),
      this.subsidiaries.memberIdsBySubsidiary(),
      this.positions.list(),
    ]);

    const named = subsidiaries.map((row) => ({
      id: row.id,
      memberIds: memberIds.get(row.id) ?? [],
      name: row.name,
      slug: row.slug,
    }));

    return {
      positions,
      subsidiaries: named,
      teams: teams.map((team) => ({
        id: team.id,
        memberIds: team.memberIds,
        name: team.name,
        organizationId: team.organizationId,
      })),
    };
  }
}
