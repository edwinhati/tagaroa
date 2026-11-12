import { expect, test } from "bun:test";

import {
  ADMIN_ROLE_IDS,
  canManageTarget,
  hasAnyRole,
  isPrivilegedRole,
  isSuperAdmin,
  mayRun,
  primaryRole,
  reviewWeekStart,
  roleCan,
  roleLabel,
  rolesOf,
} from "./identity";

test("reads a comma-separated role column by whole, trimmed names", () => {
  expect(rolesOf(" user, admin ,,")).toEqual(["user", "admin"]);
  expect(rolesOf(null)).toEqual([]);
  expect(hasAnyRole("administrator", ["admin"])).toBe(false);
  expect(hasAnyRole("user,admin", ["admin"])).toBe(true);
  expect(isSuperAdmin("admin, super-admin")).toBe(true);
  expect(isSuperAdmin("super-administrator")).toBe(false);
});

test("every back-office role is privileged, an employee is not", () => {
  expect(ADMIN_ROLE_IDS).toEqual([
    "access-reviewer",
    "helpdesk",
    "admin",
    "super-admin",
  ]);
  expect(isPrivilegedRole("helpdesk, user")).toBe(true);
  expect(isPrivilegedRole("user")).toBe(false);
  expect(isPrivilegedRole("unknown")).toBe(false);
});

test("separates review, support, administration and break-glass duties", () => {
  expect(roleCan("admin", "user", "create")).toBe(true);
  expect(roleCan("admin", "user", "set-role")).toBe(false);
  expect(roleCan("admin", "user", "delete")).toBe(false);
  expect(roleCan("access-reviewer", "user", "get")).toBe(true);
  expect(roleCan("access-reviewer", "session", "revoke")).toBe(false);
  expect(roleCan("helpdesk", "user", "set-password")).toBe(true);
  expect(roleCan("super-admin", "user", "impersonate-admins")).toBe(true);
  expect(roleCan("user,helpdesk", "session", "revoke")).toBe(true);

  expect(mayRun("access-reviewer", "operate")).toBe(true);
  expect(mayRun("access-reviewer", "support")).toBe(false);
  expect(mayRun("helpdesk", "review")).toBe(false);
  expect(mayRun("admin", "administer")).toBe(true);
  expect(mayRun("admin", "superAdmin")).toBe(false);
  expect(mayRun("user", "operate")).toBe(false);
});

test("labels a known role and leaves an unknown one as stored", () => {
  expect(roleLabel("admin")).toBe("Identity administrator");
  expect(roleLabel("legacy")).toBe("legacy");
});

test("requires break-glass authority to act on privileged accounts", () => {
  expect(canManageTarget("admin", "user")).toBe(true);
  expect(canManageTarget("admin", "helpdesk")).toBe(false);
  expect(canManageTarget("super-admin", "admin")).toBe(true);
  expect(canManageTarget("super-admin", "super-admin")).toBe(true);
});

test("shows the most senior role a person holds", () => {
  expect(primaryRole("user, helpdesk")).toBe("helpdesk");
  expect(primaryRole("super-admin,admin")).toBe("super-admin");
  expect(primaryRole(null)).toBe("user");
  expect(primaryRole("legacy")).toBe("user");
});

test("a review week starts on Monday at midnight UTC", () => {
  const week = (at: string) => reviewWeekStart(new Date(at)).toISOString();
  expect(week("2026-08-31T13:00:00Z")).toBe("2026-08-31T00:00:00.000Z");
  expect(week("2026-09-06T23:59:59Z")).toBe("2026-08-31T00:00:00.000Z");
  expect(week("2026-09-07T00:00:00Z")).toBe("2026-09-07T00:00:00.000Z");
});
