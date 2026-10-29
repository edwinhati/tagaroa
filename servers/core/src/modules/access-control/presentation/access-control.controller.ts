import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { Roles, Session, type UserSession } from "@thallesp/nestjs-better-auth";

import { SessionOnly } from "../../../platform/http/session-only.decorator";
import {
  AccessControlService,
  type AccessActor,
} from "../application/access-control.service";
import { AccessReviewService } from "../application/access-review.service";
import { DomainAccessService } from "../application/domain-access.service";
import {
  ACCESS_SCOPE_TYPES,
  type AccessScopeType,
} from "../domain/access-policy";

const ACCESS_READ_ROLES = [
  "helpdesk",
  "access-reviewer",
  "admin",
  "super-admin",
] as const;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const requiredId = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException(`${label} is required.`);
  }
  return value.trim();
};

const scopeOf = (value: unknown): AccessScopeType => {
  if (
    typeof value !== "string" ||
    !ACCESS_SCOPE_TYPES.includes(value as AccessScopeType)
  ) {
    throw new BadRequestException("Scope must be subsidiary or team.");
  }
  return value as AccessScopeType;
};

const nullableId = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const expirationOf = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new BadRequestException("Expiration must be an ISO date and time.");
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException("Expiration must be an ISO date and time.");
  }
  return parsed;
};

const actorOf = (value: UserSession): AccessActor => {
  const authSession = value as UserSession & {
    session: { createdAt: Date | string; id: string };
    user: { id: string; role?: string | null };
  };
  return {
    id: authSession.user.id,
    identityRole: authSession.user.role,
    sessionCreatedAt: new Date(authSession.session.createdAt),
    sessionId: authSession.session.id,
  };
};

@Controller("access-control")
export class AccessControlController {
  constructor(
    private readonly access: AccessControlService,
    private readonly reviews: AccessReviewService,
    private readonly domains: DomainAccessService,
  ) {}

  @Get("domains")
  @SessionOnly()
  async myDomains(@Session() session: UserSession) {
    return { data: await this.domains.mine(actorOf(session)) };
  }

  @Get("team-domains")
  @Roles([...ACCESS_READ_ROLES])
  async teamDomains() {
    return { data: await this.domains.list() };
  }

  @Put("teams/:teamId/domain")
  @Roles(["admin", "super-admin"])
  async bindDomain(
    @Param("teamId") teamId: string,
    @Body() value: unknown,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.domains.bind(
        teamId,
        asRecord(value).domainSlug,
        actorOf(session),
      ),
    };
  }

  @Get("reviews")
  @Roles([...ACCESS_READ_ROLES])
  async reviewQueue() {
    return { data: await this.reviews.list() };
  }

  @Post("reviews/:kind/:subjectId")
  @Roles(["access-reviewer", "admin", "super-admin"])
  async reviewAccess(
    @Param("kind") kind: string,
    @Param("subjectId") id: string,
    @Body() value: unknown,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.reviews.record(
        kind,
        id,
        asRecord(value),
        session.user.id,
      ),
    };
  }

  @Get("policy")
  @Roles([...ACCESS_READ_ROLES])
  async policy() {
    return { data: await this.access.policy() };
  }

  @Get("assignments")
  @Roles([...ACCESS_READ_ROLES])
  async assignments() {
    return { data: await this.access.listAssignments() };
  }

  @Post("roles")
  @Roles(["super-admin"])
  async createRole(@Body() value: unknown, @Session() session: UserSession) {
    const body = asRecord(value);
    return {
      data: await this.access.createRole(
        {
          description: body.description,
          key: body.key,
          name: body.name,
          permissions: body.permissions,
        },
        actorOf(session),
      ),
    };
  }

  @Patch("roles/:roleId")
  @Roles(["super-admin"])
  async updateRole(
    @Param("roleId") roleId: string,
    @Body() value: unknown,
    @Session() session: UserSession,
  ) {
    const body = asRecord(value);
    return {
      data: await this.access.updateRole(
        roleId,
        {
          description: body.description,
          name: body.name,
          permissions: body.permissions,
        },
        actorOf(session),
      ),
    };
  }

  @Delete("roles/:roleId")
  @Roles(["super-admin"])
  async archiveRole(
    @Param("roleId") roleId: string,
    @Session() session: UserSession,
  ) {
    return { data: await this.access.archiveRole(roleId, actorOf(session)) };
  }

  @Post("assignments")
  @Roles(["admin", "super-admin"])
  async grantAssignment(
    @Body() value: unknown,
    @Session() session: UserSession,
  ) {
    const body = asRecord(value);
    const scope = scopeOf(body.scope);
    return {
      data: await this.access.grantAssignment(
        {
          expiresAt: expirationOf(body.expiresAt),
          organizationId: requiredId(body.organizationId, "Subsidiary"),
          roleId: requiredId(body.roleId, "Role"),
          scope,
          teamId: scope === "team" ? requiredId(body.teamId, "Team") : null,
          userId: requiredId(body.userId, "Person"),
        },
        actorOf(session),
      ),
    };
  }

  @Patch("assignments/:assignmentId")
  @Roles(["admin", "super-admin"])
  async updateAssignment(
    @Param("assignmentId") assignmentId: string,
    @Body() value: unknown,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.access.updateAssignmentExpiry(
        assignmentId,
        expirationOf(asRecord(value).expiresAt),
        actorOf(session),
      ),
    };
  }

  @Delete("assignments/:assignmentId")
  @Roles(["admin", "super-admin"])
  async revokeAssignment(
    @Param("assignmentId") assignmentId: string,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.access.revokeAssignment(assignmentId, actorOf(session)),
    };
  }

  @Get("me")
  @SessionOnly()
  async me(
    @Query("organizationId") organizationId: string | undefined,
    @Query("teamId") teamId: string | undefined,
    @Session() session: UserSession,
  ) {
    const actor = actorOf(session);
    return {
      data: {
        permissions: await this.access.effectivePermissions({
          identityRole: actor.identityRole,
          organizationId: requiredId(organizationId, "Subsidiary"),
          sessionCreatedAt: actor.sessionCreatedAt,
          sessionId: actor.sessionId,
          teamId: nullableId(teamId),
          userId: actor.id,
        }),
      },
    };
  }

  @Post("break-glass")
  @Roles(["super-admin"])
  async activateBreakGlass(
    @Body() value: unknown,
    @Session() session: UserSession,
  ) {
    const body = asRecord(value);
    const scope = scopeOf(body.scope);
    return {
      data: await this.access.activateBreakGlass(
        {
          organizationId: requiredId(body.organizationId, "Subsidiary"),
          permission: requiredId(body.permission, "Permission"),
          reason: body.reason,
          scope,
          teamId: scope === "team" ? requiredId(body.teamId, "Team") : null,
        },
        actorOf(session),
      ),
    };
  }

  @Get("break-glass")
  @Roles(["super-admin"])
  async activeBreakGlass(@Session() session: UserSession) {
    return { data: await this.access.activeBreakGlass(actorOf(session)) };
  }

  @Delete("break-glass/:elevationId")
  @Roles(["super-admin"])
  async endBreakGlass(
    @Param("elevationId") elevationId: string,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.access.endBreakGlass(elevationId, actorOf(session)),
    };
  }
}
