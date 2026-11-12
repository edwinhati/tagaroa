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
  type AccessRoleView,
  type BusinessAccessPolicy,
  type AccessScopeType,
  type AccessAssignmentRecord,
  type AccessRoleRecord,
  type AssignmentView,
} from "@repo/contracts/access-control";
import { ACCESS_WINDOWS, isSuperAdmin } from "@repo/contracts/identity";

import { conflictOnUniqueViolation } from "../../../platform/database/unique-violation";
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
  isPermissionKey,
  PERMISSION_CATALOG,
  permissionsArePrivileged,
  scopesForPermissions,
  type PermissionKey,
} from "../domain/access-policy";
import {
  ACCESS_CONTROL_REPOSITORY,
  type AccessControlRepository,
} from "../domain/repositories/access-control.repository";
import {
  type AccessControl,
  type AccessDecisionInput,
} from "./access-control.facade";

const BREAK_GLASS_LIFETIME_MS = ACCESS_WINDOWS.breakGlassMinutes * 60_000;

export const SENSITIVE = "Sign in again before changing sensitive access.";

const rolePermissions = (role: AccessRoleRecord): PermissionKey[] =>
  role.permissions.filter(isPermissionKey);

const publicRole = (
  role: AccessRoleRecord,
  assignmentCount = 0,
): AccessRoleView => {
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

  async policy(): Promise<BusinessAccessPolicy> {
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
      description: string;
      key: string;
      name: string;
      permissions: PermissionKey[];
    },
    actor: Operator,
    now = new Date(),
  ) {
    requireOwnSession(actor);
    requireFresh(actor, SENSITIVE, now);
    const role = { ...input, id: randomUUID(), userId: actor.id };
    if (scopesForPermissions(role.permissions).length === 0) {
      throw new BadRequestException(
        "These permissions do not share an assignable scope.",
      );
    }
    if (await this.repository.roleKeyOrNameExists(role.key, role.name)) {
      throw new ConflictException("A role already uses that name or key.");
    }
    await conflictOnUniqueViolation(
      () => this.repository.createRole(role),
      "A role already uses that name or key.",
    );
    await this.audit.record({
      actorId: actor.id,
      detail: `${role.name} (${role.key})`,
      type: "access.role.created",
    });
    return this.repository.findRole(role.id);
  }

  async updateRole(
    id: string,
    {
      description,
      name,
      permissions,
    }: { description: string; name: string; permissions: PermissionKey[] },
    actor: Operator,
    now = new Date(),
  ) {
    requireOwnSession(actor);
    requireFresh(actor, SENSITIVE, now);
    const existing = await this.repository.findRole(id);
    if (!existing || existing.archivedAt)
      throw new NotFoundException("Role not found.");
    if (existing.system) {
      throw new BadRequestException("Built-in roles cannot be changed.");
    }
    if (scopesForPermissions(permissions).length === 0) {
      throw new BadRequestException(
        "These permissions do not share an assignable scope.",
      );
    }
    if (
      await this.repository.roleKeyOrNameExists(existing.key, name, existing.id)
    ) {
      throw new ConflictException("A role already uses that name.");
    }
    await conflictOnUniqueViolation(
      () =>
        this.repository.updateRole({
          description,
          id,
          name,
          permissions,
          userId: actor.id,
        }),
      "A role already uses that name.",
    );
    await this.audit.record({
      actorId: actor.id,
      detail: existing.key,
      type: "access.role.updated",
    });
    return this.repository.findRole(id);
  }

  async archiveRole(id: string, actor: Operator, now = new Date()) {
    requireOwnSession(actor);
    requireFresh(actor, SENSITIVE, now);
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
    actor: Operator,
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
      if (!isSuperAdmin(actor.role)) {
        throw new ForbiddenException(
          "Only a super administrator can grant privileged access.",
        );
      }
      requireFresh(actor, SENSITIVE, now);
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
    actor: Operator,
    now = new Date(),
  ) {
    requireOwnSession(actor);
    const assignment = (
      await this.repository.listAssignments({ unrevoked: true })
    ).find((candidate) => candidate.id === id);
    if (!assignment || assignment.revokedAt) {
      throw new NotFoundException("Assignment not found.");
    }
    if (permissionsArePrivileged(rolePermissions(assignment.role))) {
      if (!isSuperAdmin(actor.role)) {
        throw new ForbiddenException(
          "Only a super administrator can change privileged access.",
        );
      }
      requireFresh(actor, SENSITIVE, now);
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

  async revokeAssignment(id: string, actor: Operator, now = new Date()) {
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
      reason: string;
      scope: AccessScopeType;
      teamId: string | null;
    },
    actor: Operator,
    now = new Date(),
  ) {
    requireOwnSession(actor);
    if (!isSuperAdmin(actor.role)) {
      throw new ForbiddenException(
        "Only a super administrator can activate emergency access.",
      );
    }
    requireFresh(actor, SENSITIVE, now);
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
      reason: input.reason,
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

  async endBreakGlass(id: string, actor: Operator, now = new Date()) {
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

  activeBreakGlass(actor: Operator, now = new Date()) {
    return this.repository.activeElevations(actor.id, actor.sessionId, now);
  }

  async can({ operator, ...scope }: AccessDecisionInput): Promise<boolean> {
    const now = new Date();
    if (
      scope.teamId !== null &&
      (await this.repository.teamOrganizationId(scope.teamId)) !==
        scope.organizationId
    )
      return false;
    const input = {
      ...scope,
      at: now,
      sessionId: operator.sessionId,
      userId: operator.id,
    };
    if (await this.repository.hasEffectivePermission(input)) return true;
    if (!isSuperAdmin(operator.role)) return false;
    if (!(await this.repository.hasActiveElevation(input))) return false;
    await this.audit.record({
      actorId: operator.id,
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
