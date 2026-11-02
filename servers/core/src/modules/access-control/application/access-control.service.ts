import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../../audit/application/audit.facade";
import { isSuperAdmin, requireOwnSession } from "../../auth/access-policy";
import {
  DOMAIN_ADMINISTRATOR_ROLE,
  isPermissionKey,
  PERMISSION_CATALOG,
  permissionsArePrivileged,
  scopesForPermissions,
  type AccessScopeType,
  type PermissionKey,
} from "../domain/access-policy";
import {
  ACCESS_CONTROL_REPOSITORY,
  type AccessAssignmentRecord,
  type AccessControlRepository,
  type AccessRoleRecord,
  type AssignmentView,
} from "../domain/repositories/access-control.repository";
import type {
  AccessControl,
  AccessDecisionInput,
} from "./access-control.facade";

export const FRESH_AUTHENTICATION_MS = 15 * 60 * 1_000;
export const BREAK_GLASS_LIFETIME_MS = 15 * 60 * 1_000;

export interface AccessActor {
  id: string;
  identityRole: string | null | undefined;
  sessionCreatedAt: Date;
  sessionId: string;
  impersonatedBy?: string | null;
}

const cleanText = (value: unknown, label: string, maximum: number): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException(`${label} is required.`);
  }
  const cleaned = value.trim();
  if (cleaned.length > maximum) {
    throw new BadRequestException(
      `${label} must be ${maximum} characters or fewer.`,
    );
  }
  return cleaned;
};

const cleanKey = (value: unknown): string => {
  const key = cleanText(value, "Role key", 64);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(key)) {
    throw new BadRequestException(
      "Role key must use lowercase letters, numbers, and single hyphens.",
    );
  }
  return key;
};

const cleanPermissions = (value: unknown): PermissionKey[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException("Choose at least one permission.");
  }
  const permissions = [...new Set(value)];
  if (
    permissions.some(
      (permission) =>
        typeof permission !== "string" || !isPermissionKey(permission),
    )
  ) {
    throw new BadRequestException("The role contains an unknown permission.");
  }
  return permissions as PermissionKey[];
};

export const requireFresh = (actor: AccessActor, now: Date): void => {
  const age = now.getTime() - actor.sessionCreatedAt.getTime();
  if (!Number.isFinite(age) || age < 0 || age >= FRESH_AUTHENTICATION_MS) {
    throw new ForbiddenException({
      code: "SESSION_NOT_FRESH",
      message: "Sign in again before changing sensitive access.",
    });
  }
};

const rolePermissions = (role: AccessRoleRecord): PermissionKey[] =>
  role.permissions.filter(isPermissionKey);

const publicRole = (role: AccessRoleRecord, assignmentCount = 0) => {
  const permissions = rolePermissions(role);
  return {
    ...role,
    assignableScopes: scopesForPermissions(permissions),
    assignmentCount,
    invalidPermissions: role.permissions.filter(
      (permission) => !isPermissionKey(permission),
    ),
    permissions,
    privileged: permissionsArePrivileged(permissions),
  };
};

@Injectable()
export class AccessControlService implements AccessControl {
  constructor(
    @Inject(ACCESS_CONTROL_REPOSITORY)
    private readonly repository: AccessControlRepository,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
  ) {}

  async policy() {
    const [roles, assignments] = await Promise.all([
      this.repository.listRoles(),
      this.repository.listAssignments(),
    ]);
    const counts = new Map<string, number>();
    for (const assignment of assignments) {
      counts.set(assignment.roleId, (counts.get(assignment.roleId) ?? 0) + 1);
    }
    return {
      permissions: Object.values(PERMISSION_CATALOG),
      roles: roles.map((role) => publicRole(role, counts.get(role.id) ?? 0)),
    };
  }

  listAssignments(): Promise<AssignmentView[]> {
    return this.repository.listAssignments();
  }

  async createRole(
    input: {
      description?: unknown;
      key?: unknown;
      name?: unknown;
      permissions?: unknown;
    },
    actor: AccessActor,
    now = new Date(),
  ) {
    requireOwnSession(actor);
    requireFresh(actor, now);
    const role = {
      description: cleanText(input.description, "Description", 240),
      id: randomUUID(),
      key: cleanKey(input.key),
      name: cleanText(input.name, "Role name", 80),
      permissions: cleanPermissions(input.permissions),
      userId: actor.id,
    };
    if (scopesForPermissions(role.permissions).length === 0) {
      throw new BadRequestException(
        "These permissions do not share an assignable scope.",
      );
    }
    if (await this.repository.roleKeyOrNameExists(role.key, role.name)) {
      throw new ConflictException("A role already uses that name or key.");
    }
    await this.repository.createRole(role);
    await this.audit.record({
      actorId: actor.id,
      detail: `${role.name} (${role.key})`,
      type: "access.role.created",
    });
    return this.repository.findRole(role.id);
  }

  async updateRole(
    id: string,
    input: { description?: unknown; name?: unknown; permissions?: unknown },
    actor: AccessActor,
    now = new Date(),
  ) {
    requireOwnSession(actor);
    requireFresh(actor, now);
    const existing = await this.repository.findRole(id);
    if (!existing || existing.archivedAt)
      throw new NotFoundException("Role not found.");
    if (existing.system) {
      throw new BadRequestException("Built-in roles cannot be changed.");
    }
    const permissions = cleanPermissions(input.permissions);
    if (scopesForPermissions(permissions).length === 0) {
      throw new BadRequestException(
        "These permissions do not share an assignable scope.",
      );
    }
    const name = cleanText(input.name, "Role name", 80);
    if (
      await this.repository.roleKeyOrNameExists(existing.key, name, existing.id)
    ) {
      throw new ConflictException("A role already uses that name.");
    }
    await this.repository.updateRole({
      description: cleanText(input.description, "Description", 240),
      id,
      name,
      permissions,
      userId: actor.id,
    });
    await this.audit.record({
      actorId: actor.id,
      detail: existing.key,
      type: "access.role.updated",
    });
    return this.repository.findRole(id);
  }

  async archiveRole(id: string, actor: AccessActor, now = new Date()) {
    requireOwnSession(actor);
    requireFresh(actor, now);
    const role = await this.repository.findRole(id);
    if (!role || role.archivedAt)
      throw new NotFoundException("Role not found.");
    if (role.system) {
      throw new BadRequestException("Built-in roles cannot be archived.");
    }
    if (await this.repository.roleHasActiveAssignments(id, now)) {
      throw new ConflictException(
        "Revoke or expire this role's active assignments before archiving it.",
      );
    }
    await this.repository.archiveRole(id, actor.id, now);
    await this.audit.record({
      actorId: actor.id,
      detail: role.key,
      type: "access.role.archived",
    });
    return { archived: true as const };
  }

  private async validateScope(input: {
    organizationId: string;
    scope: AccessScopeType;
    teamId: string | null;
  }): Promise<void> {
    if (!(await this.repository.organizationExists(input.organizationId))) {
      throw new NotFoundException("Subsidiary not found.");
    }
    if (input.scope === "team") {
      if (!input.teamId) throw new BadRequestException("Choose a team.");
      if (
        (await this.repository.teamOrganizationId(input.teamId)) !==
        input.organizationId
      ) {
        throw new BadRequestException(
          "The team does not belong to this subsidiary.",
        );
      }
    } else if (input.teamId !== null) {
      throw new BadRequestException(
        "A subsidiary assignment cannot include a team.",
      );
    }
  }

  async grantAssignment(
    input: {
      expiresAt: Date | null;
      organizationId: string;
      roleId: string;
      scope: AccessScopeType;
      teamId: string | null;
      userId: string;
    },
    actor: AccessActor,
    now = new Date(),
  ): Promise<AccessAssignmentRecord> {
    requireOwnSession(actor);
    const role = await this.repository.findRole(input.roleId);
    if (!role || role.archivedAt)
      throw new NotFoundException("Role not found.");
    const permissions = rolePermissions(role);
    if (permissions.length !== role.permissions.length) {
      throw new ConflictException(
        "This role contains a permission the server does not know.",
      );
    }
    if (!scopesForPermissions(permissions).includes(input.scope)) {
      throw new BadRequestException(
        "This role cannot be assigned at that scope.",
      );
    }
    await this.validateScope(input);
    if (
      !(await this.repository.isOrganizationMember(
        input.userId,
        input.organizationId,
      ))
    ) {
      throw new BadRequestException(
        "The person is not a member of this subsidiary.",
      );
    }
    if (
      input.scope === "team" &&
      input.teamId &&
      !(await this.repository.isTeamMember(input.userId, input.teamId))
    ) {
      throw new BadRequestException("The person is not a member of this team.");
    }
    const privileged = permissionsArePrivileged(permissions);
    if (privileged) {
      if (!isSuperAdmin(actor.identityRole)) {
        throw new ForbiddenException(
          "Only a super administrator can grant privileged access.",
        );
      }
      requireFresh(actor, now);
      if (!(await this.repository.userHasTwoFactor(input.userId))) {
        throw new BadRequestException(
          "The person must set up two-factor authentication before receiving this role.",
        );
      }
    }
    if (input.expiresAt && input.expiresAt <= now) {
      throw new BadRequestException("Expiration must be in the future.");
    }
    const existing = await this.repository.findActiveAssignment(input);
    if (existing && (!existing.expiresAt || existing.expiresAt > now)) {
      return existing;
    }
    if (existing) {
      await this.repository.revokeAssignment(existing.id, actor.id, now);
    }
    const assignment = {
      ...input,
      grantedAt: now,
      grantedBy: actor.id,
      id: randomUUID(),
      revokedAt: null,
    };
    await this.repository.grantAssignment(assignment);
    await this.audit.record({
      actorId: actor.id,
      detail: `${role.key} on ${input.teamId ?? input.organizationId}`,
      targetUserId: input.userId,
      type: "access.assignment.granted",
    });
    return assignment;
  }

  async updateAssignmentExpiry(
    id: string,
    expiresAt: Date | null,
    actor: AccessActor,
    now = new Date(),
  ) {
    requireOwnSession(actor);
    const assignment = (await this.repository.listAssignments()).find(
      (candidate) => candidate.id === id,
    );
    if (!assignment || assignment.revokedAt) {
      throw new NotFoundException("Assignment not found.");
    }
    if (permissionsArePrivileged(rolePermissions(assignment.role))) {
      if (!isSuperAdmin(actor.identityRole)) {
        throw new ForbiddenException(
          "Only a super administrator can change privileged access.",
        );
      }
      requireFresh(actor, now);
    }
    if (expiresAt && expiresAt <= now) {
      throw new BadRequestException("Expiration must be in the future.");
    }
    const updated = await this.repository.updateAssignmentExpiry(id, expiresAt);
    await this.audit.record({
      actorId: actor.id,
      detail: expiresAt?.toISOString() ?? "No expiration",
      targetUserId: assignment.userId,
      type: "access.assignment.expiry-updated",
    });
    return updated;
  }

  async revokeAssignment(id: string, actor: AccessActor, now = new Date()) {
    requireOwnSession(actor);
    const revoked = await this.repository.revokeAssignment(id, actor.id, now);
    if (!revoked) throw new NotFoundException("Active assignment not found.");
    await this.audit.record({
      actorId: actor.id,
      detail: revoked.roleId,
      targetUserId: revoked.userId,
      type: "access.assignment.revoked",
    });
    return { revoked: true as const };
  }

  async activateBreakGlass(
    input: {
      organizationId: string;
      permission: string;
      reason?: unknown;
      scope: AccessScopeType;
      teamId: string | null;
    },
    actor: AccessActor,
    now = new Date(),
  ) {
    requireOwnSession(actor);
    if (!isSuperAdmin(actor.identityRole)) {
      throw new ForbiddenException(
        "Only a super administrator can activate emergency access.",
      );
    }
    requireFresh(actor, now);
    if (
      !isPermissionKey(input.permission) ||
      !PERMISSION_CATALOG[input.permission].breakGlass
    ) {
      throw new BadRequestException(
        "This permission does not allow emergency access.",
      );
    }
    if (
      !PERMISSION_CATALOG[input.permission].scopes.includes(
        input.scope as never,
      )
    ) {
      throw new BadRequestException(
        "This permission cannot be used at that scope.",
      );
    }
    await this.validateScope(input);
    const elevation = {
      expiresAt: new Date(now.getTime() + BREAK_GLASS_LIFETIME_MS),
      id: randomUUID(),
      organizationId: input.organizationId,
      permission: input.permission,
      reason: cleanText(input.reason, "Reason", 240),
      sessionId: actor.sessionId,
      teamId: input.teamId,
      userId: actor.id,
    };
    await this.repository.grantElevation(elevation);
    await this.audit.record({
      actorId: actor.id,
      detail: `${elevation.permission} on ${elevation.teamId ?? elevation.organizationId}: ${elevation.reason}`,
      type: "access.break-glass.activated",
    });
    return elevation;
  }

  async endBreakGlass(id: string, actor: AccessActor, now = new Date()) {
    requireOwnSession(actor);
    if (!(await this.repository.endElevation(id, actor.sessionId, now))) {
      throw new NotFoundException("Active emergency access not found.");
    }
    await this.audit.record({
      actorId: actor.id,
      detail: id,
      type: "access.break-glass.ended",
    });
    return { ended: true as const };
  }

  activeBreakGlass(actor: AccessActor, now = new Date()) {
    return this.repository.activeElevations(actor.id, actor.sessionId, now);
  }

  async can(input: AccessDecisionInput): Promise<boolean> {
    const now = new Date();
    if (
      input.teamId !== null &&
      (await this.repository.teamOrganizationId(input.teamId)) !==
        input.organizationId
    )
      return false;
    if (await this.repository.hasEffectivePermission({ ...input, at: now })) {
      return true;
    }
    if (!isSuperAdmin(input.identityRole)) return false;
    const elevated = await this.repository.hasActiveElevation({
      ...input,
      at: now,
    });
    if (!elevated) return false;
    await this.audit.record({
      actorId: input.userId,
      detail: `${input.permission} on ${input.teamId ?? input.organizationId}`,
      type: "access.break-glass.used",
    });
    return true;
  }

  async effectivePermissions(input: Omit<AccessDecisionInput, "permission">) {
    const permissions: PermissionKey[] = [];
    for (const permission of Object.keys(
      PERMISSION_CATALOG,
    ) as PermissionKey[]) {
      if (await this.can({ ...input, permission }))
        permissions.push(permission);
    }
    return permissions;
  }
}

export { DOMAIN_ADMINISTRATOR_ROLE };
