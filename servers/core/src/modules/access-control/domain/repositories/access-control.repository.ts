import type { AccessScopeType, PermissionKey } from "../access-policy";

export const ACCESS_CONTROL_REPOSITORY = Symbol("ACCESS_CONTROL_REPOSITORY");

export interface AccessRoleRecord {
  archivedAt: Date | null;
  createdAt: Date;
  description: string;
  id: string;
  key: string;
  name: string;
  permissions: string[];
  system: boolean;
  updatedAt: Date;
}

export interface AccessAssignmentRecord {
  expiresAt: Date | null;
  grantedAt: Date;
  grantedBy: string | null;
  id: string;
  organizationId: string;
  revokedAt: Date | null;
  roleId: string;
  teamId: string | null;
  userId: string;
}

export interface AssignmentView extends AccessAssignmentRecord {
  active: boolean;
  inactiveReason:
    | "expired"
    | "left-subsidiary"
    | "left-team"
    | "mfa-required"
    | "revoked"
    | "role-archived"
    | null;
  role: AccessRoleRecord;
}

export interface CreateRoleInput {
  description: string;
  id: string;
  key: string;
  name: string;
  permissions: PermissionKey[];
  userId: string;
}

export interface GrantAssignmentInput {
  expiresAt: Date | null;
  grantedBy: string;
  id: string;
  organizationId: string;
  roleId: string;
  scope: AccessScopeType;
  teamId: string | null;
  userId: string;
}

export interface AccessControlRepository {
  activeElevations(
    userId: string,
    sessionId: string,
    at: Date,
  ): Promise<
    {
      id: string;
      expiresAt: Date;
      organizationId: string;
      teamId: string | null;
      permission: string;
      reason: string;
    }[]
  >;
  archiveRole(id: string, userId: string, now: Date): Promise<boolean>;
  createRole(input: CreateRoleInput): Promise<void>;
  endElevation(id: string, sessionId: string, now: Date): Promise<boolean>;
  findActiveAssignment(
    input: Omit<
      GrantAssignmentInput,
      "expiresAt" | "grantedBy" | "id" | "scope"
    >,
  ): Promise<AccessAssignmentRecord | null>;
  findRole(id: string): Promise<AccessRoleRecord | null>;
  grantAssignment(input: GrantAssignmentInput): Promise<void>;
  grantElevation(input: {
    expiresAt: Date;
    id: string;
    organizationId: string;
    permission: PermissionKey;
    reason: string;
    sessionId: string;
    teamId: string | null;
    userId: string;
  }): Promise<void>;
  hasActiveElevation(input: {
    at: Date;
    organizationId: string;
    permission: PermissionKey;
    sessionId: string;
    teamId: string | null;
    userId: string;
  }): Promise<boolean>;
  hasEffectivePermission(input: {
    at: Date;
    organizationId: string;
    permission: PermissionKey;
    teamId: string | null;
    userId: string;
  }): Promise<boolean>;
  isOrganizationMember(
    userId: string,
    organizationId: string,
  ): Promise<boolean>;
  organizationExists(organizationId: string): Promise<boolean>;
  isTeamMember(userId: string, teamId: string): Promise<boolean>;
  listAssignments(): Promise<AssignmentView[]>;
  listRoles(): Promise<AccessRoleRecord[]>;
  roleKeyOrNameExists(
    key: string,
    name: string,
    exceptId?: string,
  ): Promise<boolean>;
  revokeAssignment(
    id: string,
    userId: string,
    now: Date,
  ): Promise<AccessAssignmentRecord | null>;
  roleHasActiveAssignments(roleId: string, at: Date): Promise<boolean>;
  teamOrganizationId(teamId: string): Promise<string | null>;
  updateAssignmentExpiry(
    id: string,
    expiresAt: Date | null,
  ): Promise<AccessAssignmentRecord | null>;
  updateRole(
    input: Omit<CreateRoleInput, "id" | "key"> & { id: string },
  ): Promise<boolean>;
  userHasTwoFactor(userId: string): Promise<boolean>;
}
