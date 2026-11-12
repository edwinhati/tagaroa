import {
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  HttpException,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import { IDENTITY_OPERATIONS } from "@repo/contracts/identity";
import {
  AuthService,
  Roles,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";

import { isUniqueViolation } from "../../platform/database/unique-violation";
import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../audit/application/audit.facade";
import type { Auth } from "./auth";
import {
  addMemberBody,
  type AddMemberBody,
  approveRecoveryBody,
  type ApproveRecoveryBody,
  createSubsidiaryBody,
  type CreateSubsidiaryBody,
  createTeamBody,
  type CreateTeamBody,
  offboardBody,
  type OffboardBody,
  requestRecoveryBody,
  type RequestRecoveryBody,
} from "./auth-management.schemas";
import { IdentityOperationsService } from "./identity-operations.service";
import { operatorOf, SESSION_POLICY } from "./session-policy";

@Controller("auth-management")
export class AuthManagementController {
  constructor(
    private readonly auth: AuthService<Auth>,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    private readonly operations: IdentityOperationsService,
  ) {}

  @Get("recoveries")
  @Roles([...IDENTITY_OPERATIONS.operate])
  async recoveries() {
    return { data: await this.operations.listRecoveries() };
  }

  @Post("users/:userId/factor-recovery")
  @Roles([...IDENTITY_OPERATIONS.support])
  async requestRecovery(
    @Param("userId") userId: string,
    @Body({ schema: requestRecoveryBody }) body: RequestRecoveryBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.operations.requestRecovery(
        userId,
        body,
        operatorOf(session),
      ),
    };
  }

  @Post("recoveries/:id/approve")
  @Header("Cache-Control", "no-store")
  @Roles([...IDENTITY_OPERATIONS.superAdmin])
  async approveRecovery(
    @Param("id") id: string,
    @Body({ schema: approveRecoveryBody }) body: ApproveRecoveryBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.operations.approveRecovery(
        id,
        body,
        operatorOf(session),
      ),
    };
  }

  @Post("users/:userId/offboard")
  @Roles([...IDENTITY_OPERATIONS.administer])
  async offboard(
    @Param("userId") userId: string,
    @Body({ schema: offboardBody }) body: OffboardBody,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.operations.offboard(
        userId,
        body.reason,
        operatorOf(session),
      ),
    };
  }

  @Post("sessions/:sessionId/revoke")
  @Roles([...IDENTITY_OPERATIONS.support])
  async revokeSession(
    @Param("sessionId") sessionId: string,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.operations.revokeSession(sessionId, operatorOf(session)),
    };
  }

  @Get("access-policy")
  @Roles([...IDENTITY_OPERATIONS.operate])
  accessPolicy() {
    return {
      data: {
        session: {
          concurrentLimit: SESSION_POLICY.concurrentSessions,
          freshAuthenticationMinutes:
            SESSION_POLICY.freshAuthenticationMs / 60_000,
          temporaryPasswordHours:
            SESSION_POLICY.temporaryPasswordMs / 3_600_000,
          trustedDeviceDays: SESSION_POLICY.trustedDeviceDays,
          twoFactorChallengeMinutes: SESSION_POLICY.twoFactorChallengeMinutes,
        },
      },
    };
  }

  @Post("subsidiaries")
  @Roles([...IDENTITY_OPERATIONS.superAdmin])
  async createSubsidiary(
    @Body({ schema: createSubsidiaryBody }) {
      name,
      slug,
    }: CreateSubsidiaryBody,
    @Session() session: UserSession,
  ) {
    const organization = await this.auth.api.createOrganization({
      body: { name, slug, userId: session.user.id },
    });
    await this.audit.record({
      actorId: session.user.id,
      detail: organization.id,
      type: "subsidiary.created",
    });
    return { data: organization };
  }

  @Post("subsidiaries/:organizationId/teams")
  @Roles([...IDENTITY_OPERATIONS.administer])
  async createTeam(
    @Param("organizationId") organizationId: string,
    @Body({ schema: createTeamBody }) { name }: CreateTeamBody,
    @Session() session: UserSession,
  ) {
    const team = await this.auth.api.createTeam({
      body: { name, organizationId },
    });
    await this.audit.record({
      actorId: session.user.id,
      detail: team.id,
      type: "team.created",
    });
    return { data: team };
  }

  @Post("subsidiaries/:organizationId/members")
  @Roles([...IDENTITY_OPERATIONS.administer])
  async addMember(
    @Param("organizationId") organizationId: string,
    @Body({ schema: addMemberBody }) { userId, teamId }: AddMemberBody,
    @Session() session: UserSession,
  ) {
    let member;
    try {
      member = await this.auth.api.addMember({
        body: { organizationId, userId, teamId, role: "member" },
      });
    } catch (error) {
      // The sequential duplicate is Better Auth's own 400; the concurrent one
      // reaches the `member_organizationId_userId_uidx` unique index instead.
      if (
        isUniqueViolation(error) ||
        (error instanceof APIError &&
          error.body?.code === "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION")
      )
        throw new ConflictException(
          "That person is already a member of this subsidiary.",
        );
      if (error instanceof APIError)
        throw new HttpException(error.message, error.statusCode);
      throw error;
    }
    await this.audit.record({
      actorId: session.user.id,
      detail: [organizationId, teamId].filter(Boolean).join(":"),
      targetUserId: userId,
      type: "user.subsidiary.added",
    });
    return { data: member };
  }
}
