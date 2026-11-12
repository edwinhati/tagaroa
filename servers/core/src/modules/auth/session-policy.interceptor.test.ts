import { expect, mock, test } from "bun:test";

import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { of } from "rxjs";

import { SessionPolicyInterceptor } from "./session-policy.interceptor";

const interceptor = new SessionPolicyInterceptor();

const run = (session: unknown, method = "GET") => {
  const handler = { handle: mock(() => of("handled")) } as CallHandler;
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ method, session }) }),
  } as ExecutionContext;
  try {
    interceptor.intercept(context, handler);
  } catch (error) {
    expect(handler.handle).not.toHaveBeenCalled();
    return (error as { response?: { code?: string } }).response?.code;
  }
  expect(handler.handle).toHaveBeenCalledTimes(1);
  return "passed";
};

test("lets anonymous, settled, enrolled and reading sessions through", () => {
  for (const session of [
    undefined,
    null,
    { user: {} },
    { user: { mustChangePassword: false, role: "user" } },
    { user: { role: "admin", twoFactorEnabled: true } },
    { session: { impersonatedBy: null }, user: { role: "user" } },
  ])
    expect(run(session, "POST")).toBe("passed");
  for (const method of ["GET", "HEAD", "OPTIONS"])
    expect(run({ session: { impersonatedBy: "operator" } }, method)).toBe(
      "passed",
    );
});

test("refuses a session still on its temporary password, expired or not", () => {
  expect(run({ user: { mustChangePassword: true } })).toBe(
    "MUST_CHANGE_PASSWORD",
  );
  expect(
    run({
      user: {
        mustChangePassword: true,
        temporaryPasswordExpiresAt: new Date(Date.now() - 60_000),
      },
    }),
  ).toBe("TEMPORARY_PASSWORD_EXPIRED");
});

test("requires a second factor for every privileged role", () => {
  for (const role of ["access-reviewer", "helpdesk", "admin", "super-admin"])
    expect(run({ user: { role, twoFactorEnabled: false } })).toBe(
      "PRIVILEGED_TWO_FACTOR_REQUIRED",
    );
});

test("refuses every write from an impersonated session", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"])
    expect(run({ session: { impersonatedBy: "operator" } }, method)).toBe(
      "IMPERSONATED_SESSION",
    );
});
