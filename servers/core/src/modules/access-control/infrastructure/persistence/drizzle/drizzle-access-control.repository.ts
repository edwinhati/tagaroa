import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, isNull, or, ne } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../../../../platform/database/database.module";
import {
  member,
  organization,
  team,
  teamMember,
  user,
} from "../../../../auth/infrastructure/persistence/drizzle/schema";
import {
  isPermissionKey,
  PERMISSION_CATALOG,
  type PermissionKey,
} from "../../../domain/access-policy";
import type {
  AccessAssignmentRecord,
  AccessRoleRecord,
  AssignmentView,
  AccessControlRepository,
  CreateRoleInput,
  GrantAssignmentInput,
} from "../../../domain/repositories/access-control.repository";
import {
  accessAssignment,
  accessRole,
  accessRolePermission,
  breakGlassElevation,
} from "./schema";

@Injectable()
export class DrizzleAccessControlRepository implements AccessControlRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  private async rolesById(): Promise<Map<string, AccessRoleRecord>> {
    const [roles, permissions] = await Promise.all([
      this.database.select().from(accessRole).orderBy(asc(accessRole.name)),
      this.database
        .select()
        .from(accessRolePermission)
        .orderBy(asc(accessRolePermission.permission)),
    ]);
    const byRole = new Map<string, string[]>();
    for (const row of permissions) {
      const existing = byRole.get(row.roleId);
      if (existing) existing.push(row.permission);
      else byRole.set(row.roleId, [row.permission]);
    }
    return new Map(
      roles.map((role) => [
        role.id,
        { ...role, permissions: byRole.get(role.id) ?? [] },
      ]),
    );
  }

  async listRoles(): Promise<AccessRoleRecord[]> {
    return [...(await this.rolesById()).values()];
  }

  async findRole(id: string): Promise<AccessRoleRecord | null> {
    return (await this.rolesById()).get(id) ?? null;
  }

  async roleKeyOrNameExists(
    key: string,
    name: string,
    exceptId?: string,
  ): Promise<boolean> {
    const rows = await this.database
      .select({ id: accessRole.id })
      .from(accessRole)
      .where(
        and(
          or(eq(accessRole.key, key), eq(accessRole.name, name)),
          ...(exceptId ? [ne(accessRole.id, exceptId)] : []),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async createRole(input: CreateRoleInput): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction.insert(accessRole).values({
        createdBy: input.userId,
        description: input.description,
        id: input.id,
        key: input.key,
        name: input.name,
        system: false,
        updatedBy: input.userId,
      });
      await transaction.insert(accessRolePermission).values(
        input.permissions.map((permission) => ({
          permission,
          roleId: input.id,
        })),
      );
    });
  }

  async updateRole(
    input: Omit<CreateRoleInput, "id" | "key"> & { id: string },
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const changed = await transaction
        .update(accessRole)
        .set({
          description: input.description,
          name: input.name,
          updatedAt: new Date(),
          updatedBy: input.userId,
        })
        .where(and(eq(accessRole.id, input.id), isNull(accessRole.archivedAt)))
        .returning({ id: accessRole.id });
      if (changed.length === 0) return false;
      await transaction
        .delete(accessRolePermission)
        .where(eq(accessRolePermission.roleId, input.id));
      await transaction.insert(accessRolePermission).values(
        input.permissions.map((permission) => ({
          permission,
          roleId: input.id,
        })),
      );
      return true;
    });
  }

  async roleHasActiveAssignments(roleId: string, at: Date): Promise<boolean> {
    const rows = await this.database
      .select({ id: accessAssignment.id })
      .from(accessAssignment)
      .where(
        and(
          eq(accessAssignment.roleId, roleId),
          isNull(accessAssignment.revokedAt),
          or(
            isNull(accessAssignment.expiresAt),
            gt(accessAssignment.expiresAt, at),
          ),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async archiveRole(id: string, userId: string, now: Date): Promise<boolean> {
    const rows = await this.database
      .update(accessRole)
      .set({ archivedAt: now, updatedAt: now, updatedBy: userId })
      .where(
        and(
          eq(accessRole.id, id),
          eq(accessRole.system, false),
          isNull(accessRole.archivedAt),
        ),
      )
      .returning({ id: accessRole.id });
    return rows.length > 0;
  }

  async isOrganizationMember(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    const rows = await this.database
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, organizationId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async organizationExists(organizationId: string): Promise<boolean> {
    const rows = await this.database
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    return rows.length > 0;
  }

  async isTeamMember(userId: string, teamId: string): Promise<boolean> {
    const rows = await this.database
      .select({ id: teamMember.id })
      .from(teamMember)
      .where(and(eq(teamMember.userId, userId), eq(teamMember.teamId, teamId)))
      .limit(1);
    return rows.length > 0;
  }

  async teamOrganizationId(teamId: string): Promise<string | null> {
    const [row] = await this.database
      .select({ organizationId: team.organizationId })
      .from(team)
      .where(eq(team.id, teamId))
      .limit(1);
    return row?.organizationId ?? null;
  }

  async userHasTwoFactor(userId: string): Promise<boolean> {
    const [row] = await this.database
      .select({ enabled: user.twoFactorEnabled })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.enabled === true;
  }

  async findActiveAssignment(
    input: Omit<
      GrantAssignmentInput,
      "expiresAt" | "grantedBy" | "id" | "scope"
    >,
  ): Promise<AccessAssignmentRecord | null> {
    const [row] = await this.database
      .select()
      .from(accessAssignment)
      .where(
        and(
          eq(accessAssignment.userId, input.userId),
          eq(accessAssignment.roleId, input.roleId),
          eq(accessAssignment.organizationId, input.organizationId),
          input.teamId === null
            ? isNull(accessAssignment.teamId)
            : eq(accessAssignment.teamId, input.teamId),
          isNull(accessAssignment.revokedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async grantAssignment(input: GrantAssignmentInput): Promise<void> {
    await this.database.insert(accessAssignment).values({
      expiresAt: input.expiresAt,
      grantedBy: input.grantedBy,
      id: input.id,
      organizationId: input.organizationId,
      roleId: input.roleId,
      scopeKey: input.teamId ?? input.organizationId,
      teamId: input.teamId,
      userId: input.userId,
    });
  }

  async updateAssignmentExpiry(
    id: string,
    expiresAt: Date | null,
  ): Promise<AccessAssignmentRecord | null> {
    const [row] = await this.database
      .update(accessAssignment)
      .set({ expiresAt })
      .where(
        and(eq(accessAssignment.id, id), isNull(accessAssignment.revokedAt)),
      )
      .returning();
    return row ?? null;
  }

  async revokeAssignment(
    id: string,
    userId: string,
    now: Date,
  ): Promise<AccessAssignmentRecord | null> {
    const [row] = await this.database
      .update(accessAssignment)
      .set({ revokedAt: now, revokedBy: userId })
      .where(
        and(eq(accessAssignment.id, id), isNull(accessAssignment.revokedAt)),
      )
      .returning();
    return row ?? null;
  }

  async listAssignments(): Promise<AssignmentView[]> {
    const [
      assignments,
      roles,
      organizationMemberships,
      teamMemberships,
      users,
    ] = await Promise.all([
      this.database
        .select()
        .from(accessAssignment)
        .orderBy(asc(accessAssignment.grantedAt)),
      this.rolesById(),
      this.database.select().from(member),
      this.database.select().from(teamMember),
      this.database
        .select({ id: user.id, mfa: user.twoFactorEnabled })
        .from(user),
    ]);
    const organizationMemberKeys = new Set(
      organizationMemberships.map(
        (row) => `${row.organizationId}:${row.userId}`,
      ),
    );
    const teamMemberKeys = new Set(
      teamMemberships.map((row) => `${row.teamId}:${row.userId}`),
    );
    const mfaByUser = new Map(users.map((row) => [row.id, row.mfa === true]));
    const now = new Date();

    return assignments.flatMap((assignment) => {
      const role = roles.get(assignment.roleId);
      if (!role) return [];
      const privileged = role.permissions.some(
        (permission) =>
          isPermissionKey(permission) &&
          PERMISSION_CATALOG[permission].privileged,
      );
      const inactiveReason = assignment.revokedAt
        ? "revoked"
        : role.archivedAt
          ? "role-archived"
          : assignment.expiresAt && assignment.expiresAt <= now
            ? "expired"
            : !organizationMemberKeys.has(
                  `${assignment.organizationId}:${assignment.userId}`,
                )
              ? "left-subsidiary"
              : assignment.teamId &&
                  !teamMemberKeys.has(
                    `${assignment.teamId}:${assignment.userId}`,
                  )
                ? "left-team"
                : privileged && !mfaByUser.get(assignment.userId)
                  ? "mfa-required"
                  : null;
      return [
        {
          ...assignment,
          active: inactiveReason === null,
          inactiveReason,
          role,
        },
      ];
    });
  }

  async hasEffectivePermission(input: {
    at: Date;
    organizationId: string;
    permission: PermissionKey;
    teamId: string | null;
    userId: string;
  }): Promise<boolean> {
    if (
      !(await this.isOrganizationMember(input.userId, input.organizationId))
    ) {
      return false;
    }
    if (
      PERMISSION_CATALOG[input.permission].privileged &&
      !(await this.userHasTwoFactor(input.userId))
    ) {
      return false;
    }
    const rows = await this.database
      .select({ id: accessAssignment.id, teamId: accessAssignment.teamId })
      .from(accessAssignment)
      .innerJoin(accessRole, eq(accessRole.id, accessAssignment.roleId))
      .innerJoin(
        accessRolePermission,
        eq(accessRolePermission.roleId, accessAssignment.roleId),
      )
      .where(
        and(
          eq(accessAssignment.userId, input.userId),
          eq(accessAssignment.organizationId, input.organizationId),
          eq(accessRolePermission.permission, input.permission),
          isNull(accessRole.archivedAt),
          isNull(accessAssignment.revokedAt),
          or(
            isNull(accessAssignment.expiresAt),
            gt(accessAssignment.expiresAt, input.at),
          ),
          input.teamId === null
            ? isNull(accessAssignment.teamId)
            : or(
                isNull(accessAssignment.teamId),
                eq(accessAssignment.teamId, input.teamId),
              ),
        ),
      );
    if (rows.length === 0) return false;
    if (input.teamId === null) return true;
    if (rows.some((row) => row.teamId === null)) return true;
    return this.isTeamMember(input.userId, input.teamId);
  }

  async grantElevation(input: {
    expiresAt: Date;
    id: string;
    organizationId: string;
    permission: PermissionKey;
    reason: string;
    sessionId: string;
    teamId: string | null;
    userId: string;
  }): Promise<void> {
    await this.database.insert(breakGlassElevation).values({
      expiresAt: input.expiresAt,
      id: input.id,
      organizationId: input.organizationId,
      permission: input.permission,
      reason: input.reason,
      scopeKey: input.teamId ?? input.organizationId,
      sessionId: input.sessionId,
      teamId: input.teamId,
      userId: input.userId,
    });
  }

  activeElevations(userId: string, sessionId: string, at: Date) {
    return this.database
      .select({
        id: breakGlassElevation.id,
        expiresAt: breakGlassElevation.expiresAt,
        organizationId: breakGlassElevation.organizationId,
        teamId: breakGlassElevation.teamId,
        permission: breakGlassElevation.permission,
        reason: breakGlassElevation.reason,
      })
      .from(breakGlassElevation)
      .where(
        and(
          eq(breakGlassElevation.userId, userId),
          eq(breakGlassElevation.sessionId, sessionId),
          isNull(breakGlassElevation.endedAt),
          gt(breakGlassElevation.expiresAt, at),
        ),
      )
      .orderBy(asc(breakGlassElevation.expiresAt), asc(breakGlassElevation.id));
  }

  async hasActiveElevation(input: {
    at: Date;
    organizationId: string;
    permission: PermissionKey;
    sessionId: string;
    teamId: string | null;
    userId: string;
  }): Promise<boolean> {
    const rows = await this.database
      .select({ id: breakGlassElevation.id })
      .from(breakGlassElevation)
      .where(
        and(
          eq(breakGlassElevation.sessionId, input.sessionId),
          eq(breakGlassElevation.userId, input.userId),
          eq(breakGlassElevation.permission, input.permission),
          eq(breakGlassElevation.organizationId, input.organizationId),
          isNull(breakGlassElevation.endedAt),
          gt(breakGlassElevation.expiresAt, input.at),
          input.teamId === null
            ? isNull(breakGlassElevation.teamId)
            : or(
                isNull(breakGlassElevation.teamId),
                eq(breakGlassElevation.teamId, input.teamId),
              ),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async endElevation(
    id: string,
    sessionId: string,
    now: Date,
  ): Promise<boolean> {
    const rows = await this.database
      .update(breakGlassElevation)
      .set({ endedAt: now })
      .where(
        and(
          eq(breakGlassElevation.id, id),
          eq(breakGlassElevation.sessionId, sessionId),
          isNull(breakGlassElevation.endedAt),
        ),
      )
      .returning({ id: breakGlassElevation.id });
    return rows.length > 0;
  }
}
