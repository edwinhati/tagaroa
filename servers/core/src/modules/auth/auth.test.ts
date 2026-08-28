import { expect, test } from "bun:test";

import { APIError } from "better-auth/api";

import type { AuthConfig } from "./auth";
import {
  applyTemporaryPasswordLifecycle,
  createAuth,
  excessSessionTokens,
  validateTemporaryPassword,
} from "./auth";
import { createAuthMetadataRepository } from "./infrastructure/persistence/auth.persistence.module";

test("tracks the temporary-password lifecycle after successful requests", async () => {
  const updates: Array<[string, { mustChangePassword: boolean }]> = [];
  const updateUser = async (
    userId: string,
    data: { mustChangePassword: boolean },
  ) => {
    updates.push([userId, data]);
  };

  const created = { user: { id: "new-user", mustChangePassword: false } };
  await applyTemporaryPasswordLifecycle(
    "/admin/create-user",
    {},
    created,
    updateUser,
  );
  await applyTemporaryPasswordLifecycle(
    "/admin/set-user-password",
    { userId: "reset-user" },
    { status: true },
    updateUser,
  );
  const changed = { user: { id: "changed-user", mustChangePassword: true } };
  await applyTemporaryPasswordLifecycle(
    "/change-password",
    {},
    changed,
    updateUser,
  );

  expect(updates).toEqual([
    ["new-user", { mustChangePassword: true }],
    ["reset-user", { mustChangePassword: true }],
    ["changed-user", { mustChangePassword: false }],
  ]);
  expect(created.user.mustChangePassword).toBe(true);
  expect(changed.user.mustChangePassword).toBe(false);
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

const neverBreached = async () => false;

test("validates passwords issued through admin routes", async () => {
  expect(
    validateTemporaryPassword(
      "/admin/create-user",
      { password: "short" },
      neverBreached,
    ),
  ).rejects.toThrow("Password must be at least 12 characters");
  expect(
    validateTemporaryPassword(
      "/admin/set-user-password",
      { newPassword: "x".repeat(257) },
      neverBreached,
    ),
  ).rejects.toThrow("Password must be at most 256 characters");

  // A route that carries no issued password is not this hook's business.
  await validateTemporaryPassword(
    "/sign-in/email",
    { password: "x" },
    async () => {
      throw new Error("should not be checked");
    },
  );
});

test("refuses an issued password that appears in a breach", async () => {
  expect(
    validateTemporaryPassword(
      "/admin/create-user",
      { password: "issued-password-12" },
      async () => true,
    ),
  ).rejects.toThrow("Password has been compromised in a data breach");
});

test("keeps the newest sessions and returns the rest", () => {
  const session = (token: string, minute: number) => ({
    createdAt: new Date(2026, 0, 1, 0, minute),
    token,
  });

  expect(
    excessSessionTokens([
      session("oldest", 0),
      session("second", 1),
      session("third", 2),
      session("newest", 3),
    ]),
  ).toEqual(["oldest"]);
  expect(
    excessSessionTokens([session("a", 0), session("b", 1), session("c", 2)]),
  ).toEqual([]);
});

const testConfig = {
  baseURL: "http://localhost:8080",
  nodeEnv: "test",
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
    "have-i-been-pwned",
    "open-api",
    "organization",
  ]);
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

  expect(adminPlugin?.options?.adminRoles).toEqual(["admin", "super-admin"]);
  expect(
    adminPlugin?.options?.roles?.["super-admin"]?.statements.user,
  ).toContain("impersonate-admins");
});
