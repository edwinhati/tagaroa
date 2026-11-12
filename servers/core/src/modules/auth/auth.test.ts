import { describe, expect, test } from "bun:test";

import { SESSION_ACTIONS, USER_ACTIONS } from "@repo/contracts/identity";
import { APIError, getIP } from "better-auth/api";
import { defaultStatements } from "better-auth/plugins/admin/access";

import {
  applyTemporaryPasswordLifecycle,
  type AuthConfig,
  createAuth,
  excessSessionTokens,
} from "./auth";
import { createAuthMetadataRepository } from "./infrastructure/persistence/auth.persistence.module";

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

test("the role catalog's statements are Better Auth's, so break-glass misses none", () => {
  expect([...USER_ACTIONS]).toEqual([...defaultStatements.user]);
  expect([...SESSION_ACTIONS]).toEqual([...defaultStatements.session]);
});
