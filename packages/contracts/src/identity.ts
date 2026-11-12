/**
 * Group-wide identity roles. Better Auth stores a person's roles comma-separated
 * in `user.role`, enforces these statements on its admin routes, and the apps
 * read the same list to decide what to show.
 */

export const USER_ACTIONS = [
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
] as const;
export const SESSION_ACTIONS = ["list", "revoke", "delete"] as const;

export type UserAction = (typeof USER_ACTIONS)[number];
export type SessionAction = (typeof SESSION_ACTIONS)[number];

export interface RoleStatements {
  session: readonly SessionAction[];
  user: readonly UserAction[];
}

export interface IdentityRole {
  description: string;
  id: string;
  label: string;
  permissions: RoleStatements;
  /** Admitted to the identity back office; must hold a second factor. */
  privileged: boolean;
}

export const IDENTITY_ROLES = [
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
    // Break-glass: every Better Auth admin statement, `impersonate-admins`
    // included, which restores a locked-out subsidiary admin (docs/adr/0001).
    description:
      "Assigns privileged roles, deletes accounts, and restores administrator access.",
    id: "super-admin",
    label: "Super administrator",
    permissions: { session: SESSION_ACTIONS, user: USER_ACTIONS },
    privileged: true,
  },
] as const satisfies readonly IdentityRole[];

export type IdentityRoleId = (typeof IDENTITY_ROLES)[number]["id"];

export const IDENTITY_ROLE_IDS = IDENTITY_ROLES.map((role) => role.id) as [
  IdentityRoleId,
  ...IdentityRoleId[],
];
export type AdminRoleId = Exclude<IdentityRoleId, "user">;

export const ADMIN_ROLE_IDS = IDENTITY_ROLES.filter(
  (role) => role.privileged,
).map((role) => role.id as AdminRoleId);

/**
 * Who may run each operation the core service adds beside Better Auth's own
 * routes. The server gates its routes on these; the apps hide what a person
 * cannot do.
 */
export const IDENTITY_OPERATIONS = {
  /** Read the back office: people, recoveries, reviews, policy. */
  operate: ADMIN_ROLE_IDS,
  /** Confirm that privileged or business access is still intended. */
  review: ["access-reviewer", "admin", "super-admin"],
  /** Request factor recovery, revoke a session, read a personal address. */
  support: ["helpdesk", "admin", "super-admin"],
  /** Offboard; manage teams, members, positions, bindings, assignments, notifications. */
  administer: ["admin", "super-admin"],
  /** Approve recovery, create subsidiaries and roles, emergency access. */
  superAdmin: ["super-admin"],
} as const satisfies Record<string, readonly AdminRoleId[]>;

export type IdentityOperation = keyof typeof IDENTITY_OPERATIONS;

const ROLES_BY_ID = new Map<string, IdentityRole>(
  IDENTITY_ROLES.map((role) => [role.id, role]),
);

/** The roles in a `user.role` column, trimmed, empty parts dropped. */
export const rolesOf = (column: string | null | undefined): string[] =>
  (column ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

export const hasAnyRole = (
  column: string | null | undefined,
  roles: readonly string[],
): boolean => rolesOf(column).some((role) => roles.includes(role));

export const isPrivilegedRole = (column: string | null | undefined): boolean =>
  rolesOf(column).some((role) => ROLES_BY_ID.get(role)?.privileged === true);

export const isSuperAdmin = (column: string | null | undefined): boolean =>
  rolesOf(column).includes("super-admin");

export const mayRun = (
  column: string | null | undefined,
  operation: IdentityOperation,
): boolean => hasAnyRole(column, IDENTITY_OPERATIONS[operation]);

/** Whether any held role grants this Better Auth statement. */
export function roleCan(
  column: string | null | undefined,
  resource: "user",
  action: UserAction,
): boolean;
export function roleCan(
  column: string | null | undefined,
  resource: "session",
  action: SessionAction,
): boolean;
export function roleCan(
  column: string | null | undefined,
  resource: keyof RoleStatements,
  action: string,
): boolean {
  return rolesOf(column).some((role) =>
    (
      ROLES_BY_ID.get(role)?.permissions[resource] as
        | readonly string[]
        | undefined
    )?.includes(action),
  );
}

/** The most senior role held, for showing one role per person. */
export const primaryRole = (
  column: string | null | undefined,
): IdentityRoleId => {
  const held = rolesOf(column);
  return (
    [...IDENTITY_ROLES].reverse().find((role) => held.includes(role.id))?.id ??
    "user"
  );
};

export const roleLabel = (id: string): string =>
  ROLES_BY_ID.get(id)?.label ?? id;

/** One label per person: their most senior role's. */
export const primaryRoleLabel = (column: string | null | undefined): string =>
  roleLabel(primaryRole(column));

/** Only a super-admin may act on another privileged account. */
export const canManageTarget = (
  actorRole: string | null | undefined,
  targetRole: string | null | undefined,
): boolean => isSuperAdmin(actorRole) || !isPrivilegedRole(targetRole);

/** What about an account needs acting on, as the directory reports it. */
export type AttentionKind =
  | "temporary-password"
  | "unverified-email"
  | "no-subsidiary";

/** The session rules core enforces, as `/api/auth-management/access-policy` reports them. */
export interface AuthenticationPolicy {
  session: {
    concurrentLimit: number;
    freshAuthenticationMinutes: number;
    temporaryPasswordHours: number;
    trustedDeviceDays: number;
    twoFactorChallengeMinutes: number;
  };
}

/** A request to reset someone's second factor, waiting for a super administrator. */
export interface FactorRecoveryRequest {
  approvalEvidence: string | null;
  approvedBy: string | null;
  completedAt: Date | null;
  evidence: string;
  expired: boolean;
  expiresAt: Date;
  id: string;
  reason: string;
  requestedAt: Date;
  requestedBy: string | null;
  userId: string;
}

/** Bounds for the case reference an operator records with a sensitive act. */
export const EVIDENCE_LENGTH = { max: 500, min: 10 } as const;

/**
 * The columns core adds to Better Auth's user. Core configures Better Auth with
 * this object and the clients infer the user's type from it, so neither side
 * writes the fields out again.
 */
export const USER_ADDITIONAL_FIELDS = {
  mustChangePassword: {
    defaultValue: false,
    input: false,
    required: false,
    type: "boolean",
  },
  temporaryPasswordExpiresAt: {
    input: false,
    required: false,
    type: "date",
  },
  /**
   * Where onboarding reaches a new hire before they have a workspace
   * mailbox. `input: true` because an admin is exactly who should set it,
   * and `returned: false` so it never rides along in a listing: the one
   * admin acting on one person reads it through `directory`, and every
   * other admin never holds it at all.
   */
  personalEmail: {
    input: true,
    required: false,
    returned: false,
    type: "string",
  },
} as const;

/** The longest display name a person may give themselves. */
export const DISPLAY_NAME_MAX_LENGTH = 80;

/** What a password must be; Better Auth enforces it, the door says it first. */
export const PASSWORD_LENGTH = { max: 256, min: 12 } as const;

/** How long the time-boxed grants last; the server enforces, the apps say so. */
export const ACCESS_WINDOWS = {
  breakGlassMinutes: 15,
  factorRecoveryMinutes: 60,
} as const;

/**
 * The `code` on a refusal an app acts on rather than prints: send the person
 * to re-authenticate, to the locked-out page, or to their own account.
 */
export const REFUSAL_CODES = {
  impersonated: "IMPERSONATED_SESSION",
  privilegedTarget: "PRIVILEGED_TARGET_REQUIRES_SUPER_ADMIN",
  privilegedTwoFactor: "PRIVILEGED_TWO_FACTOR_REQUIRED",
  sessionNotFresh: "SESSION_NOT_FRESH",
  temporaryPassword: "MUST_CHANGE_PASSWORD",
  temporaryPasswordExpired: "TEMPORARY_PASSWORD_EXPIRED",
} as const;

/**
 * The week an access review belongs to: Monday, UTC. A weekly obligation rather
 * than a rolling window, so "reviewed" means the same thing to everyone looking
 * on the same day, and a Friday review does not satisfy the next Wednesday.
 */
export const reviewWeekStart = (now: Date): Date => {
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday;
};
