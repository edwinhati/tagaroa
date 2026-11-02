import { expect, it } from "bun:test";

import { authClient } from "./auth-client";

it("limits each identity role to its intended account and session permissions", () => {
  const roles = [
    "access-reviewer",
    "helpdesk",
    "admin",
    "super-admin",
    "user",
  ] as const;
  const checks = [
    {
      permissions: { user: ["get"] },
      allowed: [true, true, true, true, false],
    },
    {
      permissions: { session: ["list"] },
      allowed: [true, true, true, true, false],
    },
    {
      permissions: { session: ["revoke"] },
      allowed: [false, true, true, true, false],
    },
    {
      permissions: { user: ["set-password"] },
      allowed: [false, true, true, true, false],
    },
    {
      permissions: { user: ["create"] },
      allowed: [false, false, true, true, false],
    },
    {
      permissions: { user: ["set-role"] },
      allowed: [false, false, false, true, false],
    },
    {
      permissions: { user: ["impersonate"] },
      allowed: [false, false, false, true, false],
    },
    {
      permissions: { user: ["delete"] },
      allowed: [false, false, false, true, false],
    },
  ] satisfies Array<{
    permissions: Parameters<
      typeof authClient.admin.checkRolePermission
    >[0]["permissions"];
    allowed: boolean[];
  }>;
  for (const { permissions, allowed } of checks) {
    for (const [index, role] of roles.entries()) {
      expect(
        authClient.admin.checkRolePermission({ role, permissions }),
        `${role}: ${JSON.stringify(permissions)}`,
      ).toBe(allowed[index]!);
    }
  }
});

it("reads sessions from the configured core with cookies and a request deadline", async () => {
  let requested = false;
  const data = { user: { id: "person" }, session: { id: "session" } };
  const result = await authClient.getSession({
    fetchOptions: {
      customFetchImpl: async (url, init) => {
        requested = true;
        expect(String(url)).toBe(
          `${import.meta.env.VITE_AUTH_BASE_URL ?? "http://localhost:8080"}/api/auth/get-session`,
        );
        expect(init?.credentials).toBe("include");
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        expect(init?.signal?.aborted).toBe(false);
        return Response.json(data);
      },
    },
  });
  expect(requested).toBe(true);
  expect(result.data).toMatchObject(data);
  expect(result.error).toBeNull();
});

it("exposes server denial responses without treating them as sessions", async () => {
  const result = await authClient.getSession({
    fetchOptions: {
      customFetchImpl: async () =>
        Response.json(
          { code: "UNAUTHORIZED", message: "Session expired." },
          { status: 401 },
        ),
    },
  });
  expect(result.data).toBeNull();
  expect(result.error).toMatchObject({
    status: 401,
    code: "UNAUTHORIZED",
    message: "Session expired.",
  });
});
