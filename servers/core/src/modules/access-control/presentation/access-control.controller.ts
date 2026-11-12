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
import { type ReviewKind } from "@repo/contracts/access-control";
import { IDENTITY_OPERATIONS } from "@repo/contracts/identity";
import { Roles, Session, type UserSession } from "@thallesp/nestjs-better-auth";

import { SessionOnly } from "../../../platform/http/session-only.decorator";
import { operatorOf } from "../../auth/session-policy";
import { AccessControlService } from "../application/access-control.service";
import { AccessReviewService } from "../application/access-review.service";
import { DomainAccessService } from "../application/domain-access.service";
import {
  bindDomainBody,
  breakGlassBody,
  createRoleBody,
  grantAssignmentBody,
  myPermissionsQuery,
  reviewAccessBody,
  reviewKindParam,
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
    return { data: await this.domains.mine(operatorOf(session)) };
  }

  @Get("team-domains")
  @Roles([...IDENTITY_OPERATIONS.operate])
  async teamDomains() {
    return { data: await this.domains.list() };
  }

  @Put("teams/:teamId/domain")
  @Roles([...IDENTITY_OPERATIONS.administer])
  async bindDomain(
    @Param("teamId") teamId: string,
    @Body({ schema: bindDomainBody }) body: BindDomainBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.domains.bind(
        teamId,
        body.domainSlug,
        operatorOf(session),
      ),
    };
  }

  @Get("reviews")
  @Roles([...IDENTITY_OPERATIONS.operate])
  async reviewQueue() {
    return { data: await this.reviews.list() };
  }

  @Post("reviews/:kind/:subjectId")
  @Roles([...IDENTITY_OPERATIONS.review])
  async reviewAccess(
    @Param("kind", { schema: reviewKindParam }) kind: ReviewKind,
    @Param("subjectId") id: string,
    @Body({ schema: reviewAccessBody })
    body: ReviewAccessBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.reviews.record(kind, id, body, operatorOf(session)),
    };
  }

  @Get("policy")
  @Roles([...IDENTITY_OPERATIONS.operate])
  async policy() {
    return { data: await this.access.policy() };
  }

  @Get("assignments")
  @Roles([...IDENTITY_OPERATIONS.operate])
  async assignments() {
    return { data: await this.access.listAssignments() };
  }

  @Post("roles")
  @Roles([...IDENTITY_OPERATIONS.superAdmin])
  async createRole(
    @Body({ schema: createRoleBody }) body: CreateRoleBody,
    @Session() session: UserSession,
  ) {
    return { data: await this.access.createRole(body, operatorOf(session)) };
  }

  @Patch("roles/:roleId")
  @Roles([...IDENTITY_OPERATIONS.superAdmin])
  async updateRole(
    @Param("roleId") roleId: string,
    @Body({ schema: updateRoleBody }) body: UpdateRoleBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.access.updateRole(roleId, body, operatorOf(session)),
    };
  }

  @Delete("roles/:roleId")
  @Roles([...IDENTITY_OPERATIONS.superAdmin])
  async archiveRole(
    @Param("roleId") roleId: string,
    @Session() session: UserSession,
  ) {
    return { data: await this.access.archiveRole(roleId, operatorOf(session)) };
  }

  @Post("assignments")
  @Roles([...IDENTITY_OPERATIONS.administer])
  async grantAssignment(
    @Body({ schema: grantAssignmentBody }) body: GrantAssignmentBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.access.grantAssignment(body, operatorOf(session)),
    };
  }

  @Patch("assignments/:assignmentId")
  @Roles([...IDENTITY_OPERATIONS.administer])
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
        operatorOf(session),
      ),
    };
  }

  @Delete("assignments/:assignmentId")
  @Roles([...IDENTITY_OPERATIONS.administer])
  async revokeAssignment(
    @Param("assignmentId") assignmentId: string,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.access.revokeAssignment(
        assignmentId,
        operatorOf(session),
      ),
    };
  }

  @Get("me")
  @SessionOnly()
  async me(
    @Query({ schema: myPermissionsQuery })
    query: MyPermissionsQuery,
    @Session() session: UserSession,
  ) {
    return {
      data: {
        permissions: await this.access.effectivePermissions({
          ...query,
          operator: operatorOf(session),
        }),
      },
    };
  }

  @Post("break-glass")
  @Roles([...IDENTITY_OPERATIONS.superAdmin])
  async activateBreakGlass(
    @Body({ schema: breakGlassBody }) body: BreakGlassBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.access.activateBreakGlass(body, operatorOf(session)),
    };
  }

  @Get("break-glass")
  @Roles([...IDENTITY_OPERATIONS.superAdmin])
  async activeBreakGlass(@Session() session: UserSession) {
    return { data: await this.access.activeBreakGlass(operatorOf(session)) };
  }

  @Delete("break-glass/:elevationId")
  @Roles([...IDENTITY_OPERATIONS.superAdmin])
  async endBreakGlass(
    @Param("elevationId") elevationId: string,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.access.endBreakGlass(elevationId, operatorOf(session)),
    };
  }
}
