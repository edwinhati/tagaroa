import "reflect-metadata";
import { expect, test } from "bun:test";

import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { AllowAnonymous, Roles } from "@thallesp/nestjs-better-auth";

import { SessionOnly } from "../../../platform/http/session-only.decorator";
import { AccessControlGuard } from "./access-control.guard";
import { RequiresPermission } from "./requires-permission.decorator";

class Routes {
  undeclared() {}
  @AllowAnonymous()
  public() {}
  @SessionOnly()
  me() {}
  @Roles(["admin"])
  admin() {}
  @RequiresPermission({
    permission: "domain:administer",
    organizationParam: "organizationId",
    teamParam: "teamId",
  })
  configure() {}
}

const context = (method: keyof Routes, request: unknown): ExecutionContext =>
  new ExecutionContextHost([request], Routes, Routes.prototype[method]);

const session = {
  user: { id: "person", role: "user" },
  session: { id: "session", createdAt: new Date() },
};

test("undeclared routes deny even signed-in administrators; public and self routes are explicit", async () => {
  const guard = new AccessControlGuard(new Reflector(), {
    can: async () => true,
  });
  await expect(
    guard.canActivate(
      context("undeclared", {
        session: { ...session, user: { id: "admin", role: "admin" } },
      }),
    ),
  ).rejects.toThrow("You do not have access");
  expect(await guard.canActivate(context("public", {}))).toBe(true);
  await expect(guard.canActivate(context("me", {}))).rejects.toThrow(
    "You do not have access",
  );
  expect(await guard.canActivate(context("me", { session }))).toBe(true);
  await expect(
    guard.canActivate(context("admin", { session })),
  ).rejects.toThrow("You do not have access");
  expect(
    await guard.canActivate(
      context("admin", {
        session: { ...session, user: { id: "admin", role: "admin" } },
      }),
    ),
  ).toBe(true);
});

test("resource routes require all scope parameters and a successful server decision", async () => {
  const decisions: unknown[] = [];
  const guard = new AccessControlGuard(new Reflector(), {
    can: async (input) => {
      decisions.push(input);
      return false;
    },
  });
  await expect(
    guard.canActivate(
      context("configure", {
        session,
        params: { organizationId: "subsidiary" },
      }),
    ),
  ).rejects.toThrow("You do not have access");
  expect(decisions).toEqual([]);
  await expect(
    guard.canActivate(
      context("configure", {
        session,
        params: { organizationId: "subsidiary", teamId: "team" },
      }),
    ),
  ).rejects.toThrow("You do not have access");
  expect(decisions).toMatchObject([
    {
      userId: "person",
      organizationId: "subsidiary",
      teamId: "team",
      permission: "domain:administer",
    },
  ]);
});
