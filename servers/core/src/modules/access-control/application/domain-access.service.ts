import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type DomainMembership } from "@repo/contracts/access-control";

import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../../audit/application/audit.facade";
import {
  type Operator,
  requireFresh,
  requireOwnSession,
} from "../../auth/session-policy";
import {
  ACCESS_CONTROL_REPOSITORY,
  type AccessControlRepository,
} from "../domain/repositories/access-control.repository";
import {
  DOMAIN_ACCESS_REPOSITORY,
  type DomainAccessRepository,
} from "../domain/repositories/domain-access.repository";
import { AccessControlService, SENSITIVE } from "./access-control.service";

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
  async mine(operator: Operator): Promise<DomainMembership[]> {
    const teams = await this.domains.mine(operator.id);
    return Promise.all(
      teams.map(async (team) => ({
        ...team,
        administered: await this.access.can({
          operator,
          organizationId: team.organizationId,
          permission: "domain:administer",
          teamId: team.teamId,
        }),
      })),
    );
  }
  async bind(teamId: string, domainSlug: string | null, actor: Operator) {
    requireOwnSession(actor);
    requireFresh(actor, SENSITIVE);
    if (!(await this.repository.teamOrganizationId(teamId)))
      throw new NotFoundException("Team not found.");
    await this.domains.bind(teamId, domainSlug);
    await this.audit.record({
      actorId: actor.id,
      type: "access.team-domain.changed",
      detail: `${teamId}: ${domainSlug ?? "none"}`,
    });
    return { teamId, domainSlug };
  }
}
