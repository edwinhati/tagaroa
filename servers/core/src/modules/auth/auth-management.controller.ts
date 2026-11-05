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
import {
  AuthService,
  Roles,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";

import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../audit/application/audit.facade";
import { ADMIN_ROLE_CATALOG, ADMIN_ROLE_IDS } from "./access-policy";
import { createAuth, TEMPORARY_PASSWORD_LIFETIME_MS } from "./auth";
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
import {
  IdentityOperationsService,
  type IdentityOperator,
} from "./identity-operations.service";

type TagaroaAuth = ReturnType<typeof createAuth>;

const operatorOf = (session: UserSession): IdentityOperator => {
  const value = session as UserSession & {
    session: { createdAt: string | Date; impersonatedBy?: string | null };
    user: { role?: string | null; twoFactorEnabled?: boolean };
  };
  return {
    id: value.user.id,
    role: value.user.role,
    twoFactorEnabled: value.user.twoFactorEnabled === true,
    sessionCreatedAt: new Date(value.session.createdAt),
    impersonatedBy: value.session.impersonatedBy,
  };
};

/** Postgres 23505, seen through Drizzle's wrapper (`cause`) or Bun SQL's `errno`. */
const isUniqueViolation = (error: unknown): boolean => {
  const e = error as
    | { cause?: unknown; code?: unknown; errno?: unknown }
    | undefined;
  return (
    e?.code === "23505" ||
    e?.errno === "23505" ||
    (e?.cause !== undefined && isUniqueViolation(e.cause))
  );
};

@Controller("auth-management")
export class AuthManagementController {
  constructor(
    private readonly auth: AuthService<TagaroaAuth>,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    private readonly operations: IdentityOperationsService,
  ) {}

  @Get("recoveries")
  @Roles(["helpdesk", "admin", "super-admin", "access-reviewer"])
  async recoveries() {
    return { data: await this.operations.listRecoveries() };
  }

  @Post("users/:userId/factor-recovery")
  @Roles(["helpdesk", "admin", "super-admin"])
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
  @Roles(["super-admin"])
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
  @Roles(["admin", "super-admin"])
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
  @Roles(["helpdesk", "admin", "super-admin"])
  async revokeSession(
    @Param("sessionId") sessionId: string,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.operations.revokeSession(sessionId, operatorOf(session)),
    };
  }

  @Get("access-policy")
  @Roles([...ADMIN_ROLE_IDS])
  accessPolicy() {
    return {
      data: {
        roles: ADMIN_ROLE_CATALOG,
        session: {
          concurrentLimit: 3,
          freshAuthenticationMinutes: 15,
          temporaryPasswordHours:
            TEMPORARY_PASSWORD_LIFETIME_MS / (60 * 60 * 1_000),
          trustedDeviceDays: 30,
          twoFactorChallengeMinutes: 10,
        },
      },
    };
  }

  @Post("subsidiaries")
  @Roles(["super-admin"])
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
  @Roles(["admin", "super-admin"])
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
  @Roles(["admin", "super-admin"])
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
