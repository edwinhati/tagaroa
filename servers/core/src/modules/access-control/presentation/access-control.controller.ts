import {
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
  bindDomainBody,
  breakGlassBody,
  createRoleBody,
  grantAssignmentBody,
  myPermissionsQuery,
  reviewAccessBody,
  updateAssignmentBody,
  updateRoleBody,
  type BindDomainBody,
  type BreakGlassBody,
  type CreateRoleBody,
  type GrantAssignmentBody,
  type MyPermissionsQuery,
  type ReviewAccessBody,
  type UpdateAssignmentBody,
  type UpdateRoleBody,
} from "./access-control.schemas";

const ACCESS_READ_ROLES = [
  "helpdesk",
  "access-reviewer",
  "admin",
  "super-admin",
] as const;

const actorOf = (value: UserSession): AccessActor => {
  const authSession = value as UserSession & {
    session: {
      createdAt: Date | string;
      id: string;
      impersonatedBy?: string | null;
    };
    user: { id: string; role?: string | null };
  };
  return {
    id: authSession.user.id,
    identityRole: authSession.user.role,
    sessionCreatedAt: new Date(authSession.session.createdAt),
    sessionId: authSession.session.id,
    impersonatedBy: authSession.session.impersonatedBy,
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
    @Body({ schema: bindDomainBody }) body: BindDomainBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.domains.bind(teamId, body.domainSlug, actorOf(session)),
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
    @Body({ schema: reviewAccessBody })
    body: ReviewAccessBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.reviews.record(kind, id, body, actorOf(session)),
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
  async createRole(
    @Body({ schema: createRoleBody }) body: CreateRoleBody,
    @Session() session: UserSession,
  ) {
    return { data: await this.access.createRole(body, actorOf(session)) };
  }

  @Patch("roles/:roleId")
  @Roles(["super-admin"])
  async updateRole(
    @Param("roleId") roleId: string,
    @Body({ schema: updateRoleBody }) body: UpdateRoleBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.access.updateRole(roleId, body, actorOf(session)),
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
    @Body({ schema: grantAssignmentBody }) body: GrantAssignmentBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.access.grantAssignment(body, actorOf(session)),
    };
  }

  @Patch("assignments/:assignmentId")
  @Roles(["admin", "super-admin"])
  async updateAssignment(
    @Param("assignmentId") assignmentId: string,
    @Body({ schema: updateAssignmentBody })
    body: UpdateAssignmentBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.access.updateAssignmentExpiry(
        assignmentId,
        body.expiresAt,
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
    @Query({ schema: myPermissionsQuery })
    query: MyPermissionsQuery,
    @Session() session: UserSession,
  ) {
    const actor = actorOf(session);
    return {
      data: {
        permissions: await this.access.effectivePermissions({
          identityRole: actor.identityRole,
          organizationId: query.organizationId,
          sessionCreatedAt: actor.sessionCreatedAt,
          sessionId: actor.sessionId,
          teamId: query.teamId,
          userId: actor.id,
        }),
      },
    };
  }

  @Post("break-glass")
  @Roles(["super-admin"])
  async activateBreakGlass(
    @Body({ schema: breakGlassBody }) body: BreakGlassBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.access.activateBreakGlass(body, actorOf(session)),
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
