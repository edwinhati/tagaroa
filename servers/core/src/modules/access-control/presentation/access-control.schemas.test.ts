import { describe, expect, test } from "bun:test";

import {
  bindDomainBody,
  breakGlassBody,
  grantAssignmentBody,
  myPermissionsQuery,
  updateAssignmentBody,
} from "./access-control.schemas";

const valid = {
  organizationId: " org-1 ",
  roleId: "role-1",
  scope: "subsidiary",
  userId: "user-1",
};

const message = (input: unknown) => {
  const result = grantAssignmentBody.safeParse(input);
  return result.success ? undefined : result.error.issues[0]!.message;
};

describe("grantAssignmentBody", () => {
  test("trims ids and defaults to no expiry and no team", () => {
    expect(grantAssignmentBody.parse(valid)).toEqual({
      expiresAt: null,
      organizationId: "org-1",
      roleId: "role-1",
      scope: "subsidiary",
      teamId: null,
      userId: "user-1",
    });
  });

  test("a team scope needs a team; a subsidiary scope drops one", () => {
    expect(message({ ...valid, scope: "team" })).toBe("Team is required.");
    expect(
      grantAssignmentBody.parse({ ...valid, scope: "team", teamId: "t-1" })
        .teamId,
    ).toBe("t-1");
    expect(
      grantAssignmentBody.parse({ ...valid, teamId: "t-1" }).teamId,
    ).toBeNull();
  });

  test("parses an expiry date, and treats null and empty as none", () => {
    const parsed = grantAssignmentBody.parse({
      ...valid,
      expiresAt: "2026-12-01T00:00:00Z",
    });
    expect(parsed.expiresAt?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(
      grantAssignmentBody.parse({ ...valid, expiresAt: "" }).expiresAt,
    ).toBeNull();
    expect(
      grantAssignmentBody.parse({ ...valid, expiresAt: null }).expiresAt,
    ).toBeNull();
  });

  test("keeps the sentences the controller helpers used", () => {
    expect(message({ ...valid, scope: "galaxy" })).toBe(
      "Scope must be subsidiary or team.",
    );
    expect(message({ ...valid, expiresAt: "soon" })).toBe(
      "Expiration must be an ISO date and time.",
    );
    expect(message({ ...valid, expiresAt: 5 })).toBe(
      "Expiration must be an ISO date and time.",
    );
    expect(message({ ...valid, organizationId: "  " })).toBe(
      "Subsidiary is required.",
    );
    expect(message({ ...valid, roleId: undefined })).toBe("Role is required.");
    expect(message({ ...valid, userId: 7 })).toBe("Person is required.");
  });

  test("a body that is not an object is a 400 sentence, not a crash", () => {
    expect(message("nope")).toBe("Request body must be a JSON object.");
    expect(message(undefined)).toBe("Request body must be a JSON object.");
  });
});

describe("the other access-control bodies", () => {
  const glass = {
    organizationId: "org-1",
    permission: " finance.approve ",
    reason: "Payroll run is blocked.",
    scope: "subsidiary",
  } as const;

  test("break-glass trims ids and applies the team rule", () => {
    expect(breakGlassBody.parse({ ...glass, teamId: "t-1" })).toEqual({
      ...glass,
      permission: "finance.approve",
      teamId: null,
    });
    expect(
      breakGlassBody.safeParse({ ...glass, scope: "team" }).error?.issues[0]!
        .message,
    ).toBe("Team is required.");
    expect(
      breakGlassBody.safeParse({ ...glass, permission: "" }).error?.issues[0]!
        .message,
    ).toBe("Permission is required.");
  });

  test("an expiry update keeps the grant's date rule", () => {
    expect(updateAssignmentBody.parse({}).expiresAt).toBeNull();
    expect(
      updateAssignmentBody.safeParse({ expiresAt: "soon" }).error?.issues[0]!
        .message,
    ).toBe("Expiration must be an ISO date and time.");
  });

  test("a domain binding takes a slug or null", () => {
    expect(bindDomainBody.parse({ domainSlug: null }).domainSlug).toBeNull();
    expect(bindDomainBody.safeParse({}).error?.issues[0]!.message).toBe(
      "Choose a known domain or no domain.",
    );
  });

  test("my permissions need a subsidiary; a blank team is none", () => {
    expect(
      myPermissionsQuery.parse({ organizationId: " o ", teamId: " " }),
    ).toEqual({
      organizationId: "o",
      teamId: null,
    });
    expect(myPermissionsQuery.safeParse({}).error?.issues[0]!.message).toBe(
      "Subsidiary is required.",
    );
  });
});
