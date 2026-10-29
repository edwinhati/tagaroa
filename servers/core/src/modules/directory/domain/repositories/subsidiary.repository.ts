import type { Subsidiary, Team } from "../entities/subsidiary.entity";

export const SUBSIDIARY_REPOSITORY = Symbol("SUBSIDIARY_REPOSITORY");

/**
 * The group's shape: its companies, their teams, and who is in them.
 *
 * Teams come back with membership only. Business permissions belong to access
 * control and never become a second field on Better Auth's membership rows.
 */
export interface SubsidiaryRepository {
  listSubsidiaries(): Promise<Subsidiary[]>;
  memberIdsBySubsidiary(): Promise<Map<string, string[]>>;
  listTeams(): Promise<Team[]>;
  /** Everyone who is in at least one team. */
  membershipUserIds(): Promise<Set<string>>;
  countSubsidiaries(): Promise<number>;
}
