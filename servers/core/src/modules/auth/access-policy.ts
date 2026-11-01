import { ForbiddenException } from "@nestjs/common";

export const ADMIN_ROLE_IDS = [
  "access-reviewer",
  "helpdesk",
  "admin",
  "super-admin",
] as const;

export type AdminRoleId = (typeof ADMIN_ROLE_IDS)[number];
export type IdentityRoleId = "user" | AdminRoleId;

export interface RoleDefinition {
  description: string;
  id: IdentityRoleId;
  label: string;
  permissions: {
    session: readonly ("list" | "revoke" | "delete")[];
    user: readonly (
      | "create"
      | "list"
      | "set-role"
      | "ban"
      | "impersonate"
      | "impersonate-admins"
      | "delete"
      | "set-password"
      | "set-email"
      | "get"
      | "update"
    )[];
  };
  privileged: boolean;
}

/**
 * Group-wide roles are static policy, not subsidiary roles. Keeping the catalog
 * here gives Better Auth, Nest guards, and the read-only admin page one source
 * of truth.
 */
export const ADMIN_ROLE_CATALOG: readonly RoleDefinition[] = [
  {
    description:
      "Accesses workspace domains through subsidiary and team membership.",
    id: "user",
    label: "Employee",
    permissions: { session: [], user: [] },
    privileged: false,
  },
  {
    description: "Reviews accounts, sessions, and privileged access.",
    id: "access-reviewer",
    label: "Access reviewer",
    permissions: { session: ["list"], user: ["list", "get"] },
    privileged: true,
  },
  {
    description: "Resets employee passwords and revokes employee sessions.",
    id: "helpdesk",
    label: "Helpdesk",
    permissions: {
      session: ["list", "revoke", "delete"],
      user: ["list", "get", "set-password"],
    },
    privileged: true,
  },
  {
    description:
      "Creates and updates accounts, resets passwords, and manages subsidiary access.",
    id: "admin",
    label: "Identity administrator",
    permissions: {
      session: ["list", "revoke", "delete"],
      user: [
        "create",
        "list",
        "ban",
        "set-password",
        "set-email",
        "get",
        "update",
      ],
    },
    privileged: true,
  },
  {
    description:
      "Assigns privileged roles, deletes accounts, and restores administrator access.",
    id: "super-admin",
    label: "Super administrator",
    permissions: {
      session: ["list", "revoke", "delete"],
      user: [
        "create",
        "list",
        "set-role",
        "ban",
        "impersonate",
        "impersonate-admins",
        "delete",
        "set-password",
        "set-email",
        "get",
        "update",
      ],
    },
    privileged: true,
  },
] as const;

const ADMIN_ROLE_SET = new Set<string>(ADMIN_ROLE_IDS);

export const rolesOf = (role: string | null | undefined): string[] =>
  (role ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

export const isAdminRole = (role: string | null | undefined): boolean =>
  rolesOf(role).some((part) => ADMIN_ROLE_SET.has(part));

export const isSuperAdmin = (role: string | null | undefined): boolean =>
  rolesOf(role).includes("super-admin");

export const isPrivilegedRole = (role: string | null | undefined): boolean =>
  isAdminRole(role);

export const canManageTarget = (
  actorRole: string | null | undefined,
  targetRole: string | null | undefined,
): boolean => isSuperAdmin(actorRole) || !isPrivilegedRole(targetRole);

export const removesSuperAdminRole = (
  currentRole: string | null | undefined,
  nextRole: unknown,
): boolean =>
  isSuperAdmin(currentRole) &&
  ![nextRole]
    .flat()
    .some((role) => typeof role === "string" && isSuperAdmin(role));

export const OWN_OPERATOR_ACCOUNT_REQUIRED =
  "Use your own MFA-protected operator account.";

/**
 * An impersonated session acts as its target, carrying the target's MFA state
 * and a fresh `createdAt`, so it must never stand in for an operator's own act:
 * a grant, a break-glass or an independent review would be recorded as the
 * impersonated person.
 */
export const requireOwnSession = (actor: {
  impersonatedBy?: string | null;
}): void => {
  if (actor.impersonatedBy)
    throw new ForbiddenException(OWN_OPERATOR_ACCOUNT_REQUIRED);
};
