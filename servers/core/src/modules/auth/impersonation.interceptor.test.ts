import { expect, mock, test } from "bun:test";

import {
  type CallHandler,
  type ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { of } from "rxjs";

import { ImpersonationInterceptor } from "./impersonation.interceptor";

const contextFor = (method: string, session: unknown) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ method, session }) }),
  }) as ExecutionContext;

const interceptor = new ImpersonationInterceptor();
const impersonated = { session: { impersonatedBy: "operator-id" } };

test("lets reads through, impersonated or not", () => {
  const handler = { handle: mock(() => of("handled")) } as CallHandler;

  for (const method of ["GET", "HEAD", "OPTIONS"])
    interceptor.intercept(contextFor(method, impersonated), handler);

  expect(handler.handle).toHaveBeenCalledTimes(3);
});

test("lets an operator's own writes through", () => {
  const handler = { handle: mock(() => of("handled")) } as CallHandler;

  for (const session of [
    undefined,
    null,
    { session: {} },
    { session: { impersonatedBy: null } },
  ])
    interceptor.intercept(contextFor("POST", session), handler);

  expect(handler.handle).toHaveBeenCalledTimes(4);
});

test("refuses every write from an impersonated session", () => {
  const handler = { handle: mock(() => of("handled")) } as CallHandler;

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    expect(() =>
      interceptor.intercept(contextFor(method, impersonated), handler),
    ).toThrow(ForbiddenException);
  }
  expect(handler.handle).not.toHaveBeenCalled();
});
