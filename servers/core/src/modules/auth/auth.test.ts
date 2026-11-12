import { describe, expect, test } from "bun:test";

import { SESSION_ACTIONS, USER_ACTIONS } from "@repo/contracts/identity";
import { APIError, getIP } from "better-auth/api";
import { defaultStatements } from "better-auth/plugins/admin/access";

import type { AuthConfig } from "./auth";
import {
  adminAuditEvent,
  applyTemporaryPasswordLifecycle,
  authenticationAuditEvent,
  createAuth,
  endedSessionAuditEvent,
  excessSessionTokens,
  removesSuperAdminRole,
  validateAdminUserUpdate,
  validatePersonalEmail,
  validateProfileUpdate,
  validateTemporaryPassword,
} from "./auth";
import { createAuthMetadataRepository } from "./infrastructure/persistence/auth.persistence.module";

test("describes successful admin writes as durable audit events", () => {
  expect(
    adminAuditEvent(
      "/admin/create-user",
      { email: "person@tagaroa.test" },
      { user: { email: "person@tagaroa.test", id: "person-id" } },
    ),
  ).toEqual({
    detail: "person@tagaroa.test",
    targetUserId: "person-id",
    type: "user.created",
  });
  expect(
    adminAuditEvent(
      "/admin/set-role",
      { role: ["admin", "user"], userId: "person-id" },
      { user: { id: "person-id" } },
    ),
  ).toEqual({
    detail: "admin, user",
    targetUserId: "person-id",
    type: "user.role.updated",
  });
  expect(
    adminAuditEvent(
      "/admin/update-user",
      {
        data: { email: "new@tagaroa.test", name: "New name" },
        userId: "person-id",
      },
      { id: "person-id" },
    ),
  ).toEqual({
    detail: "email, name",
    targetUserId: "person-id",
    type: "user.updated",
  });
  expect(adminAuditEvent("/admin/list-users", {}, [])).toBeUndefined();
  expect(
    adminAuditEvent(
      "/organization/add-member",
      {
        organizationId: "subsidiary-id",
        role: "member",
        teamId: "team-id",
        userId: "person-id",
      },
      { id: "membership-id" },
    ),
  ).toEqual({
    detail: "subsidiary-id:team-id",
    targetUserId: "person-id",
    type: "user.subsidiary.added",
  });
  expect(
    adminAuditEvent(
      "/organization/remove-team-member",
      { teamId: "team-id", userId: "person-id" },
      { message: "Team member removed successfully." },
    ),
  ).toEqual({
    detail: "team-id",
    targetUserId: "person-id",
    type: "user.team.removed",
  });
});

test("describes successful authentication assurance events durably", () => {
  expect(
    authenticationAuditEvent(
      "/sign-in/email",
      { user: { id: "person-id" } },
      undefined,
    ),
  ).toEqual({
    actorId: "person-id",
    targetUserId: "person-id",
    type: "user.signed-in",
  });
  expect(
    authenticationAuditEvent("/two-factor/verify-backup-code", {}, "person-id"),
  ).toEqual({
    actorId: "person-id",
    targetUserId: "person-id",
    type: "user.two-factor.recovery-used",
  });
  expect(
    authenticationAuditEvent("/passkey/verify-registration", {}, "person-id"),
  ).toEqual({
    actorId: "person-id",
    targetUserId: "person-id",
    type: "user.passkey.added",
  });
  expect(
    authenticationAuditEvent("/update-user", { status: true }, "person-id"),
  ).toEqual({
    actorId: "person-id",
    targetUserId: "person-id",
    type: "user.profile.updated",
  });
  expect(
    authenticationAuditEvent(
      "/sign-in/email",
      { twoFactorRedirect: true, user: { id: "person-id" } },
      undefined,
    ),
  ).toBeUndefined();
});

test("holds a self-service profile update to the display name", () => {
  expect(validateProfileUpdate("/update-user", { name: " Ada " })).toEqual({
    name: "Ada",
  });
  expect(validateProfileUpdate("/admin/update-user", {})).toBeUndefined();
  expect(() =>
    validateProfileUpdate("/update-user", {
      name: "Ada",
      personalEmail: "ada@example.test",
    }),
  ).toThrow("Only your name can be changed here.");
  expect(() => validateProfileUpdate("/update-user", { name: "" })).toThrow(
    "Name is required.",
  );
});

test("tracks the temporary-password lifecycle after successful requests", async () => {
  const updates: Array<
    [
      string,
      {
        mustChangePassword: boolean;
        temporaryPasswordExpiresAt: Date | null;
      },
    ]
  > = [];
  const updateUser = async (
    userId: string,
    data: {
      mustChangePassword: boolean;
      temporaryPasswordExpiresAt: Date | null;
    },
  ) => {
    updates.push([userId, data]);
  };

  const now = new Date("2026-09-01T12:00:00.000Z");
  const expiresAt = new Date("2026-09-02T12:00:00.000Z");
  const created = {
    user: {
      id: "new-user",
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null as Date | null,
    },
  };
  await applyTemporaryPasswordLifecycle(
    "/admin/create-user",
    {},
    created,
    updateUser,
    now,
  );
  await applyTemporaryPasswordLifecycle(
    "/admin/set-user-password",
    { userId: "reset-user" },
    { status: true },
    updateUser,
    now,
  );
  const changed = {
    user: {
      id: "changed-user",
      mustChangePassword: true,
      temporaryPasswordExpiresAt: expiresAt as Date | null,
    },
  };
  await applyTemporaryPasswordLifecycle(
    "/change-password",
    {},
    changed,
    updateUser,
    now,
  );

  expect(updates).toEqual([
    [
      "new-user",
      { mustChangePassword: true, temporaryPasswordExpiresAt: expiresAt },
    ],
    [
      "reset-user",
      { mustChangePassword: true, temporaryPasswordExpiresAt: expiresAt },
    ],
    [
      "changed-user",
      { mustChangePassword: false, temporaryPasswordExpiresAt: null },
    ],
  ]);
  expect(created.user.mustChangePassword).toBe(true);
  expect(created.user.temporaryPasswordExpiresAt).toEqual(expiresAt);
  expect(changed.user.mustChangePassword).toBe(false);
  expect(changed.user.temporaryPasswordExpiresAt).toBeNull();
});

test("does not clear the flag after a rejected password change", async () => {
  let updated = false;

  await applyTemporaryPasswordLifecycle(
    "/change-password",
    {},
    new APIError("BAD_REQUEST", { message: "Wrong password" }),
    async () => {
      updated = true;
    },
  );

  expect(updated).toBe(false);
});

test("validates passwords issued through admin routes", () => {
  expect(() =>
    validateTemporaryPassword("/admin/create-user", { password: "short" }),
  ).toThrow("Password must be at least 12 characters");
  expect(() =>
    validateTemporaryPassword("/admin/set-user-password", {
      newPassword: "x".repeat(257),
    }),
  ).toThrow("Password must be at most 256 characters");

  // A route that carries no issued password is not this hook's business.
  expect(() =>
    validateTemporaryPassword("/sign-in/email", { password: "x" }),
  ).not.toThrow();
});

test("requires a deliverable personal address when an account is issued", () => {
  expect(() =>
    validatePersonalEmail("/admin/create-user", {
      data: { personalEmail: "person@personal.test" },
    }),
  ).not.toThrow();

  // The onboarding message is the only one the workspace sends to staff, and it
  // has nowhere to go without this.
  expect(() =>
    validatePersonalEmail("/admin/create-user", { data: {} }),
  ).toThrow("A personal email address is required to issue an account");
  expect(() => validatePersonalEmail("/admin/create-user", {})).toThrow(
    "A personal email address is required to issue an account",
  );
  expect(() =>
    validatePersonalEmail("/admin/create-user", {
      data: { personalEmail: "not-an-address" },
    }),
  ).toThrow("That is not a valid personal email address");

  // The workspace mailbox is exactly where the password must not go.
  expect(() =>
    validatePersonalEmail("/admin/create-user", {
      data: { personalEmail: "Person@Tagaroa.test" },
      email: "person@tagaroa.test",
    }),
  ).toThrow("must differ from the workspace address");

  // An update may leave the address alone, but not corrupt it.
  expect(() =>
    validatePersonalEmail("/admin/update-user", { data: { name: "Ana" } }),
  ).not.toThrow();
  expect(() =>
    validatePersonalEmail("/admin/update-user", {
      data: { personalEmail: "" },
    }),
  ).toThrow("That is not a valid personal email address");

  // A route that carries no personal address is not this hook's business.
  expect(() =>
    validatePersonalEmail("/sign-in/email", { data: { personalEmail: "x" } }),
  ).not.toThrow();
});

describe("excessSessionTokens", () => {
  const now = new Date(2026, 0, 8);
  const live = new Date(2026, 0, 15);
  const session = (token: string, day: number, expiresAt = live) => ({
    expiresAt,
    token,
    updatedAt: new Date(2026, 0, day),
  });

  test("drops the least recently used session past the cap", () => {
    expect(
      excessSessionTokens(
        [
          session("idle", 1),
          session("second", 2),
          session("third", 3),
          session("newest", 4),
        ],
        now,
      ),
    ).toEqual(["idle"]);
  });

  test("leaves a person at the cap alone", () => {
    expect(
      excessSessionTokens(
        [session("a", 1), session("b", 2), session("c", 3)],
        now,
      ),
    ).toEqual([]);
  });

  test("an operator's impersonation takes none of the person's slots", () => {
    expect(
      excessSessionTokens(
        [
          session("a", 1),
          session("b", 2),
          session("c", 3),
          { ...session("operator", 4), impersonatedBy: "operator-id" },
        ],
        now,
      ),
    ).toEqual([]);
  });

  // Expired rows linger until Better Auth purges them. Counting them would
  // evict the one session the person is actually using.
  test("ignores sessions that have already expired", () => {
    const expired = new Date(2026, 0, 2);

    expect(
      excessSessionTokens(
        [
          session("live-but-idle", 1),
          session("dead", 3, expired),
          session("also-dead", 4, expired),
          session("newest", 5),
        ],
        now,
      ),
    ).toEqual([]);
  });
});

const testConfig = {
  baseURL: "http://localhost:8080",
  nodeEnv: "test",
  passkeyOrigins: "http://localhost:3001",
  passkeyRpId: "localhost",
  secret: "test-secret-with-at-least-thirty-two-characters",
  trustedOrigins: ["http://localhost:8080"],
} satisfies AuthConfig;

// `nodeEnv: "test"` is the one value that turns off the database-backed rate
// limiter, which lets the metadata-only repository serve handler-free tests.
// Any handler call under another nodeEnv reaches the adapter and throws.
test("exposes the Better Auth health endpoint", async () => {
  const auth = createAuth(createAuthMetadataRepository(), testConfig);

  const response = await auth.handler(
    new Request("http://localhost:8080/api/auth/ok"),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(auth.options.plugins?.map((plugin) => plugin.id)).toEqual([
    "admin",
    "two-factor",
    "passkey",
    "bearer",
    "have-i-been-pwned",
    "open-api",
    "organization",
  ]);
});

// Pangolin forwards the client, Caddy appends Pangolin's hop. Walking right to
// left past the trusted hops lands on the client, never on what it claimed.
test("resolves the rate-limit IP to the client behind two trusted proxies", () => {
  const { options } = createAuth(createAuthMetadataRepository(), {
    ...testConfig,
    trustedProxies: ["172.18.0.0/16", "10.0.0.0/8"],
  });
  const ipFor = (forwardedFor: string) =>
    getIP(
      new Request("http://localhost:8080/api/auth/sign-in/email", {
        headers: { "x-forwarded-for": forwardedFor },
      }),
      options,
    );

  expect(ipFor("203.0.113.7, 10.0.0.4, 172.18.0.3")).toBe("203.0.113.7");
  expect(ipFor("198.51.100.66, 203.0.113.7, 10.0.0.4, 172.18.0.3")).toBe(
    "203.0.113.7",
  );
});

// Asserted on the options rather than through a request: rejecting a sign-up is
// Better Auth's own behaviour, and reaching it needs a real database. What is
// ours to get right is that no environment leaves the door open.
test("closes email sign-up in every environment", () => {
  for (const nodeEnv of ["development", "production", "test"] as const) {
    expect(
      createAuth(createAuthMetadataRepository(), { ...testConfig, nodeEnv })
        .options.emailAndPassword?.disableSignUp,
    ).toBe(true);
  }
});

test("grants break-glass to the super-admin role", () => {
  const { options } = createAuth(createAuthMetadataRepository(), testConfig);
  const adminPlugin = options.plugins?.find((plugin) => plugin.id === "admin");

  expect(adminPlugin?.options?.adminRoles).toEqual([
    "access-reviewer",
    "helpdesk",
    "admin",
    "super-admin",
  ]);
  expect(
    adminPlugin?.options?.roles?.["super-admin"]?.statements.user,
  ).toContain("impersonate-admins");
  expect(adminPlugin?.options?.roles?.admin?.statements.user).not.toContain(
    "impersonate",
  );
  expect(adminPlugin?.options?.roles?.admin?.statements.user).not.toContain(
    "set-role",
  );
  expect(adminPlugin?.options?.roles?.admin?.statements.user).not.toContain(
    "delete",
  );
});

test("subsidiary departure audit uses the removed member's identity, not the request identifier", () => {
  expect(
    adminAuditEvent(
      "/organization/remove-member",
      { memberIdOrEmail: "membership-id" },
      { member: { userId: "employee-id", organizationId: "subsidiary-id" } },
    ),
  ).toEqual({
    targetUserId: "employee-id",
    detail: "subsidiary-id",
    type: "user.subsidiary.removed",
  });
  expect(
    adminAuditEvent(
      "/organization/remove-member",
      { memberIdOrEmail: "membership-id" },
      {},
    ),
  ).toBeUndefined();
});

test("audits subsidiary and team edits made on Better Auth's own routes", () => {
  expect(
    adminAuditEvent(
      "/organization/update",
      { data: { name: "Renamed" }, organizationId: "subsidiary-id" },
      { id: "subsidiary-id", name: "Renamed" },
    ),
  ).toEqual({ detail: "subsidiary-id", type: "subsidiary.updated" });
  expect(
    adminAuditEvent(
      "/organization/update-team",
      { data: { name: "Renamed team" }, teamId: "team-id" },
      { id: "team-id", name: "Renamed team" },
    ),
  ).toEqual({ detail: "team-id", type: "team.updated" });
  expect(
    adminAuditEvent(
      "/organization/remove-team",
      { teamId: "team-id" },
      { message: "Team removed successfully." },
    ),
  ).toEqual({ detail: "team-id", type: "team.removed" });
  expect(adminAuditEvent("/organization/update", {}, null)).toBeUndefined();
});

test("audits the end of impersonation by the operator who started it", () => {
  expect(
    endedSessionAuditEvent("/admin/stop-impersonating", {
      impersonatedBy: "operator-id",
      userId: "person-id",
    }),
  ).toEqual({
    actorId: "operator-id",
    targetUserId: "person-id",
    type: "user.impersonation.ended",
  });
  // Signing out, or a fourth device evicting the oldest, is not an admin act.
  // A revoked session is audited by `IdentityOperationsService.revokeSession`.
  expect(
    endedSessionAuditEvent("/sign-out", { userId: "person-id" }),
  ).toBeUndefined();
});

test("an admin update may change only the fields apps/admin edits", () => {
  for (const data of [
    { name: "Ada" },
    { email: "ada@tagaroa.test", personalEmail: "ada@personal.example" },
    { role: "helpdesk" },
  ])
    expect(() =>
      validateAdminUserUpdate("/admin/update-user", { data, userId: "u" }),
    ).not.toThrow();
  for (const data of [
    { twoFactorEnabled: false },
    { mustChangePassword: false },
    { temporaryPasswordExpiresAt: null },
    { banned: true },
    { name: "Ada", emailVerified: false },
  ])
    expect(() =>
      validateAdminUserUpdate("/admin/update-user", { data, userId: "u" }),
    ).toThrow(APIError);
  expect(() =>
    validateAdminUserUpdate("/update-user", { twoFactorEnabled: false }),
  ).not.toThrow();
});

test("demotion to another privileged role still removes super-admin authority", () => {
  for (const role of [
    "admin",
    "helpdesk",
    "access-reviewer",
    "user",
    ["admin", "helpdesk"],
  ]) {
    expect(removesSuperAdminRole("super-admin", role)).toBe(true);
  }
  expect(removesSuperAdminRole("super-admin", "admin, super-admin")).toBe(
    false,
  );
  expect(removesSuperAdminRole("super-admin", ["admin", "super-admin"])).toBe(
    false,
  );
  expect(removesSuperAdminRole("admin", "user")).toBe(false);
});

test("the role catalog's statements are Better Auth's, so break-glass misses none", () => {
  expect([...USER_ACTIONS]).toEqual([...defaultStatements.user]);
  expect([...SESSION_ACTIONS]).toEqual([...defaultStatements.session]);
});
