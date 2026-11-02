import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WORKING_DOMAINS } from "@repo/contracts";

import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../../audit/application/audit.facade";
import { requireOwnSession } from "../../auth/access-policy";
import {
  ACCESS_CONTROL_REPOSITORY,
  type AccessControlRepository,
} from "../domain/repositories/access-control.repository";
import {
  DOMAIN_ACCESS_REPOSITORY,
  type DomainAccessRepository,
} from "../domain/repositories/domain-access.repository";
import {
  AccessControlService,
  requireFresh,
  type AccessActor,
} from "./access-control.service";

@Injectable()
export class DomainAccessService {
  constructor(
    @Inject(DOMAIN_ACCESS_REPOSITORY)
    private readonly domains: DomainAccessRepository,
    @Inject(ACCESS_CONTROL_REPOSITORY)
    private readonly repository: AccessControlRepository,
    private readonly access: AccessControlService,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
  ) {}
  list() {
    return this.domains.list();
  }
  async mine(actor: AccessActor) {
    const teams = await this.domains.mine(actor.id);
    return Promise.all(
      teams.map(async (team) => ({
        ...team,
        administered: await this.access.can({
          userId: actor.id,
          identityRole: actor.identityRole,
          sessionCreatedAt: actor.sessionCreatedAt,
          sessionId: actor.sessionId,
          organizationId: team.organizationId,
          teamId: team.teamId,
          permission: "domain:administer",
        }),
      })),
    );
  }
  async bind(teamId: string, domainSlug: unknown, actor: AccessActor) {
    requireOwnSession(actor);
    requireFresh(actor, new Date());
    if (
      domainSlug !== null &&
      !WORKING_DOMAINS.some((domain) => domain.slug === domainSlug)
    )
      throw new BadRequestException("Choose a known domain or no domain.");
    if (!(await this.repository.teamOrganizationId(teamId)))
      throw new NotFoundException("Team not found.");
    await this.domains.bind(teamId, domainSlug as string | null);
    await this.audit.record({
      actorId: actor.id,
      type: "access.team-domain.changed",
      detail: `${teamId}: ${domainSlug ?? "none"}`,
    });
    return { teamId, domainSlug };
  }
}
