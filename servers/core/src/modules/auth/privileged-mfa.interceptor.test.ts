import { expect, mock, test } from "bun:test";

import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { of } from "rxjs";

import { PrivilegedMfaInterceptor } from "./privileged-mfa.interceptor";

const contextFor = (session: unknown, originalUrl = "/api/directory") =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl, session }),
    }),
  }) as ExecutionContext;

const interceptor = new PrivilegedMfaInterceptor();

test("requires 2FA for every privileged back-office role", () => {
  for (const role of ["access-reviewer", "helpdesk", "admin", "super-admin"]) {
    const handler = { handle: mock(() => of("handled")) } as CallHandler;
    expect(() =>
      interceptor.intercept(
        contextFor({ user: { role, twoFactorEnabled: false } }),
        handler,
      ),
    ).toThrow("Set up two-factor authentication");
    expect(handler.handle).not.toHaveBeenCalled();
  }
});

test("allows enrollment routes, employees, and enrolled operators", () => {
  const handler = { handle: mock(() => of("handled")) } as CallHandler;
  for (const [session, path] of [
    [
      { user: { role: "admin", twoFactorEnabled: false } },
      "/api/auth/two-factor/enable",
    ],
    [
      { user: { role: "user", twoFactorEnabled: false } },
      "/api/directory/mine",
    ],
    [{ user: { role: "admin", twoFactorEnabled: true } }, "/api/directory"],
  ] as const) {
    expect(
      interceptor.intercept(contextFor(session, path), handler),
    ).toBeDefined();
  }
  expect(handler.handle).toHaveBeenCalledTimes(3);
});
