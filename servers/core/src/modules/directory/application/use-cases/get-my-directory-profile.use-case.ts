import { Inject, Injectable } from "@nestjs/common";

import {
  PERSON_REPOSITORY,
  type PersonRepository,
} from "../../domain/repositories/person.repository";
import {
  POSITION_REPOSITORY,
  type PositionRepository,
} from "../../domain/repositories/position.repository";
import {
  SUBSIDIARY_REPOSITORY,
  type SubsidiaryRepository,
} from "../../domain/repositories/subsidiary.repository";

export interface MyPositionView {
  id: string;
  managerName: string | null;
  /** Null means the position is recorded at group scope. */
  subsidiaryName: string | null;
  title: string;
}

export interface MySubsidiaryView {
  id: string;
  name: string;
}

export interface MyTeamView {
  id: string;
  name: string;
  subsidiaryName: string;
}

export interface MyDirectoryProfile {
  positions: MyPositionView[];
  subsidiaries: MySubsidiaryView[];
  teams: MyTeamView[];
}

/**
 * What the signed-in person may read about themselves from the directory:
 * titles, subsidiaries and teams. Never personal email, never the full roster.
 */
@Injectable()
export class GetMyDirectoryProfileUseCase {
  constructor(
    @Inject(POSITION_REPOSITORY)
    private readonly positions: PositionRepository,
    @Inject(PERSON_REPOSITORY) private readonly people: PersonRepository,
    @Inject(SUBSIDIARY_REPOSITORY)
    private readonly subsidiaries: SubsidiaryRepository,
  ) {}

  async execute(userId: string): Promise<MyDirectoryProfile> {
    const [rows, subsidiaries, teams, membersBySubsidiary] = await Promise.all([
      this.positions.listForUser(userId),
      this.subsidiaries.listSubsidiaries(),
      this.subsidiaries.listTeams(),
      this.subsidiaries.memberIdsBySubsidiary(),
    ]);

    const subsidiaryName = new Map(
      subsidiaries.map((subsidiary) => [subsidiary.id, subsidiary.name]),
    );

    const mySubsidiaries = subsidiaries
      .filter((subsidiary) =>
        (membersBySubsidiary.get(subsidiary.id) ?? []).includes(userId),
      )
      .map((subsidiary) => ({ id: subsidiary.id, name: subsidiary.name }));

    const myTeams = teams
      .filter((team) => team.memberIds.includes(userId))
      .map((team) => ({
        id: team.id,
        name: team.name,
        subsidiaryName:
          subsidiaryName.get(team.organizationId) ?? "Unknown subsidiary",
      }));

    const managerIds = rows
      .map((row) => row.managerUserId)
      .filter((id): id is string => typeof id === "string");
    const managerNames = await this.people.displayNamesOf(managerIds);

    return {
      positions: rows.map((row) => ({
        id: row.id,
        managerName: row.managerUserId
          ? (managerNames.get(row.managerUserId) ?? null)
          : null,
        subsidiaryName: row.organizationId
          ? (subsidiaryName.get(row.organizationId) ?? null)
          : null,
        title: row.title,
      })),
      subsidiaries: mySubsidiaries,
      teams: myTeams,
    };
  }
}
