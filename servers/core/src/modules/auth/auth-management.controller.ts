import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import { asObject } from "@repo/contracts";
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
  IdentityOperationsService,
  type IdentityOperator,
} from "./identity-operations.service";

type TagaroaAuth = ReturnType<typeof createAuth>;

const requiredText = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException(`${label} is required.`);
  }
  return value.trim();
};

const requiredSlug = (value: unknown): string => {
  const slug = requiredText(value, "Slug");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new BadRequestException(
      "Slug must contain lowercase letters, numbers, and single hyphens only.",
    );
  }
  return slug;
};

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
    @Body() body: unknown,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.operations.requestRecovery(
        userId,
        asObject(body) ?? {},
        operatorOf(session),
      ),
    };
  }

  @Post("recoveries/:id/approve")
  @Header("Cache-Control", "no-store")
  @Roles(["super-admin"])
  async approveRecovery(
    @Param("id") id: string,
    @Body() body: unknown,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.operations.approveRecovery(
        id,
        asObject(body) ?? {},
        operatorOf(session),
      ),
    };
  }

  @Post("users/:userId/offboard")
  @Roles(["admin", "super-admin"])
  async offboard(
    @Param("userId") userId: string,
    @Body() body: unknown,
    @Session() session: UserSession,
  ) {
    return {
      data: await this.operations.offboard(
        userId,
        asObject(body)?.reason,
        operatorOf(session),
      ),
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
    @Body() body: { name?: unknown; slug?: unknown },
    @Session() session: UserSession,
  ) {
    const name = requiredText(body.name, "Name");
    const slug = requiredSlug(body.slug);
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
    @Body() body: { name?: unknown },
    @Session() session: UserSession,
  ) {
    const team = await this.auth.api.createTeam({
      body: { name: requiredText(body.name, "Team name"), organizationId },
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
    @Body() body: { userId?: unknown; teamId?: unknown; role?: unknown },
    @Session() session: UserSession,
  ) {
    if (body.role !== undefined && body.role !== "member") {
      throw new BadRequestException(
        "Only standard subsidiary membership may be assigned here.",
      );
    }
    const userId = requiredText(body.userId, "Person");
    const teamId =
      body.teamId === undefined ? undefined : requiredText(body.teamId, "Team");
    let member;
    try {
      member = await this.auth.api.addMember({
        body: { organizationId, userId, teamId, role: "member" },
      });
    } catch (error) {
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
