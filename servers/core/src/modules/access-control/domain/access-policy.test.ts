import { describe, expect, test } from "bun:test";

import {
  isPermissionKey,
  permissionsArePrivileged,
  scopesForPermissions,
} from "./access-policy";

describe("business access policy", () => {
  test("recognizes only code-owned permissions", () => {
    expect(isPermissionKey("domain:administer")).toBe(true);
    expect(isPermissionKey("domain:anything")).toBe(false);
  });

  test("derives privilege and assignable scopes from permissions", () => {
    expect(permissionsArePrivileged(["domain:administer"])).toBe(true);
    expect(scopesForPermissions(["domain:administer"])).toEqual([
      "subsidiary",
      "team",
    ]);
  });
});
