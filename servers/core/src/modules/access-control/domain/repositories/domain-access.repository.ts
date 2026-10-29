export const DOMAIN_ACCESS_REPOSITORY = Symbol("DOMAIN_ACCESS_REPOSITORY");
export interface TeamDomain {
  teamId: string;
  domainSlug: string;
}
export interface DomainAccessRepository {
  list(): Promise<TeamDomain[]>;
  mine(userId: string): Promise<(TeamDomain & { organizationId: string })[]>;
  bind(teamId: string, domainSlug: string | null): Promise<void>;
}
