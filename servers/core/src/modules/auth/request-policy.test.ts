import { expect, test } from "bun:test";

import { APIError } from "better-auth/api";

import {
  removesSuperAdminRole,
  validateAdminUserUpdate,
  validatePersonalEmail,
  validateProfileUpdate,
  validateTemporaryPassword,
} from "./request-policy";

test("holds a self-service profile update to the display name", () => {
  expect(validateProfileUpdate("/update-user", { name: " Ada " })).toEqual({
    name: "Ada",
  });
  expect(validateProfileUpdate("/admin/update-user", {})).toBeUndefined();
  expect(() =>
    validateProfileUpdate("/update-user", {
      name: "Ada",
      personalEmail: "ada@example.test",
    }),
  ).toThrow("Only your name can be changed here.");
  expect(() => validateProfileUpdate("/update-user", { name: "" })).toThrow(
    "Name is required.",
  );
});

test("validates passwords issued through admin routes", () => {
  expect(() =>
    validateTemporaryPassword("/admin/create-user", { password: "short" }),
  ).toThrow("Password must be at least 12 characters");
  expect(() =>
    validateTemporaryPassword("/admin/set-user-password", {
      newPassword: "x".repeat(257),
    }),
  ).toThrow("Password must be at most 256 characters");

  // A route that carries no issued password is not this hook's business.
  expect(() =>
    validateTemporaryPassword("/sign-in/email", { password: "x" }),
  ).not.toThrow();
});

test("requires a deliverable personal address when an account is issued", () => {
  expect(() =>
    validatePersonalEmail("/admin/create-user", {
      data: { personalEmail: "person@personal.test" },
    }),
  ).not.toThrow();

  // The onboarding message is the only one the workspace sends to staff, and it
  // has nowhere to go without this.
  expect(() =>
    validatePersonalEmail("/admin/create-user", { data: {} }),
  ).toThrow("A personal email address is required to issue an account");
  expect(() => validatePersonalEmail("/admin/create-user", {})).toThrow(
    "A personal email address is required to issue an account",
  );
  expect(() =>
    validatePersonalEmail("/admin/create-user", {
      data: { personalEmail: "not-an-address" },
    }),
  ).toThrow("That is not a valid personal email address");

  // The workspace mailbox is exactly where the password must not go.
  expect(() =>
    validatePersonalEmail("/admin/create-user", {
      data: { personalEmail: "Person@Tagaroa.test" },
      email: "person@tagaroa.test",
    }),
  ).toThrow("must differ from the workspace address");

  // An update may leave the address alone, but not corrupt it.
  expect(() =>
    validatePersonalEmail("/admin/update-user", { data: { name: "Ana" } }),
  ).not.toThrow();
  expect(() =>
    validatePersonalEmail("/admin/update-user", {
      data: { personalEmail: "" },
    }),
  ).toThrow("That is not a valid personal email address");

  // A route that carries no personal address is not this hook's business.
  expect(() =>
    validatePersonalEmail("/sign-in/email", { data: { personalEmail: "x" } }),
  ).not.toThrow();
});

test("an admin update may change only the fields apps/admin edits", () => {
  for (const data of [
    { name: "Ada" },
    { email: "ada@tagaroa.test", personalEmail: "ada@personal.example" },
    { role: "helpdesk" },
  ])
    expect(() =>
      validateAdminUserUpdate("/admin/update-user", { data, userId: "u" }),
    ).not.toThrow();
  for (const data of [
    { twoFactorEnabled: false },
    { mustChangePassword: false },
    { temporaryPasswordExpiresAt: null },
    { banned: true },
    { name: "Ada", emailVerified: false },
  ])
    expect(() =>
      validateAdminUserUpdate("/admin/update-user", { data, userId: "u" }),
    ).toThrow(APIError);
  expect(() =>
    validateAdminUserUpdate("/update-user", { twoFactorEnabled: false }),
  ).not.toThrow();
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
