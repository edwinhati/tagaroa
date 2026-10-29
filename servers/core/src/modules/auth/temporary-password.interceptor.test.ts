import { expect, mock, test } from "bun:test";

import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { of } from "rxjs";

import { TemporaryPasswordInterceptor } from "./temporary-password.interceptor";

const contextFor = (session: unknown) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ session }) }),
  }) as ExecutionContext;

const interceptor = new TemporaryPasswordInterceptor();

test("lets an anonymous or settled request through", () => {
  const handler = { handle: mock(() => of("handled")) } as CallHandler;

  for (const session of [
    undefined,
    null,
    { user: {} },
    { user: { mustChangePassword: false } },
  ]) {
    expect(interceptor.intercept(contextFor(session), handler)).toBeDefined();
  }

  expect(handler.handle).toHaveBeenCalledTimes(4);
});

test("reports an expired temporary password distinctly", () => {
  const handler = { handle: mock(() => of("handled")) } as CallHandler;

  expect(() =>
    interceptor.intercept(
      contextFor({
        user: {
          mustChangePassword: true,
          temporaryPasswordExpiresAt: new Date(Date.now() - 60_000),
        },
      }),
      handler,
    ),
  ).toThrow("That temporary password has expired");
  expect(handler.handle).not.toHaveBeenCalled();
});

test("refuses a session still on its temporary password", () => {
  const handler = { handle: mock(() => of("handled")) } as CallHandler;

  expect(() =>
    interceptor.intercept(
      contextFor({ user: { mustChangePassword: true } }),
      handler,
    ),
  ).toThrow("Replace your temporary password before using the workspace.");
  expect(handler.handle).not.toHaveBeenCalled();
});
