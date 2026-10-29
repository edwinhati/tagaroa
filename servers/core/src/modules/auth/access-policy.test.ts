import { describe, expect, test } from "bun:test";

import {
  ADMIN_ROLE_CATALOG,
  canManageTarget,
  isAdminRole,
  isPrivilegedRole,
  removesSuperAdminRole,
} from "./access-policy";

describe("identity access policy", () => {
  test("separates review, support, administration, and break-glass duties", () => {
    expect(ADMIN_ROLE_CATALOG.map(({ id }) => id)).toEqual([
      "user",
      "access-reviewer",
      "helpdesk",
      "admin",
      "super-admin",
    ]);

    const admin = ADMIN_ROLE_CATALOG.find(({ id }) => id === "admin");
    expect(admin?.permissions.user).toContain("create");
    expect(admin?.permissions.user).not.toContain("set-role");
    expect(admin?.permissions.user).not.toContain("delete");

    const reviewer = ADMIN_ROLE_CATALOG.find(
      ({ id }) => id === "access-reviewer",
    );
    expect(reviewer?.permissions.user).toEqual(["list", "get"]);
  });

  test("treats every back-office role as an admin-app role", () => {
    expect(isAdminRole("access-reviewer")).toBe(true);
    expect(isAdminRole("helpdesk, user")).toBe(true);
    expect(isAdminRole("user")).toBe(false);
  });

  test("requires break-glass authority to act on privileged accounts", () => {
    expect(isPrivilegedRole("helpdesk")).toBe(true);
    expect(canManageTarget("admin", "user")).toBe(true);
    expect(canManageTarget("admin", "helpdesk")).toBe(false);
    expect(canManageTarget("super-admin", "admin")).toBe(true);
    expect(canManageTarget("super-admin", "super-admin")).toBe(true);
  });
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
