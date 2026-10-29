import { describe, expect, test } from "bun:test";

import { Roles } from "./roles.vo";

describe("Roles.parse", () => {
  test("splits the comma-separated column and drops the blanks", () => {
    expect(Roles.parse("admin, user ,").names).toEqual(["admin", "user"]);
  });

  test("a person with no role holds none", () => {
    expect(Roles.parse(null).names).toEqual([]);
  });
});

describe("Roles.privileged", () => {
  test("passes every group-wide back-office role", () => {
    expect(Roles.parse("access-reviewer").privileged).toBe(true);
    expect(Roles.parse("helpdesk").privileged).toBe(true);
    expect(Roles.parse("admin").privileged).toBe(true);
    expect(Roles.parse("user,super-admin").privileged).toBe(true);
  });

  test("refuses a role that merely contains one", () => {
    expect(Roles.parse("administrator").privileged).toBe(false);
    expect(Roles.parse("user").privileged).toBe(false);
    expect(Roles.parse(null).privileged).toBe(false);
  });
});
