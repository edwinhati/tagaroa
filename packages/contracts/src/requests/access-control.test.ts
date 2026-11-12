import { describe, expect, test } from "bun:test";

import {
  bindDomainBody,
  breakGlassBody,
  createRoleBody,
  grantAssignmentBody,
  myPermissionsQuery,
  reviewAccessBody,
  reviewKindParam,
  updateAssignmentBody,
  updateRoleBody,
} from "./access-control";

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

  test("a domain binding takes a known slug or null", () => {
    expect(bindDomainBody.parse({ domainSlug: null }).domainSlug).toBeNull();
    expect(bindDomainBody.parse({ domainSlug: "finance" }).domainSlug).toBe(
      "finance",
    );
    for (const domainSlug of ["unknown", "Engineering", "", undefined, 1, {}])
      expect(
        bindDomainBody.safeParse({ domainSlug }).error?.issues[0]!.message,
      ).toBe("Choose a known domain or no domain.");
  });

  test("my permissions need a subsidiary; a blank team is none", () => {
    expect(
      myPermissionsQuery.parse({ organizationId: " o ", teamId: " " }),
    ).toEqual({
      organizationId: "o",
      teamId: null,
    });
    expect(myPermissionsQuery.parse({ organizationId: "o" }).teamId).toBeNull();
    expect(myPermissionsQuery.safeParse({}).error?.issues[0]!.message).toBe(
      "Subsidiary is required.",
    );
  });
});

describe("role bodies", () => {
  const valid = {
    description: " Configure domains ",
    key: "custom-admin",
    name: " Custom ",
    permissions: ["domain:administer", "domain:administer"],
  };
  const message = (body: unknown) =>
    createRoleBody.safeParse(body).error?.issues[0]!.message;

  test("trim the text and collapse repeated permissions", () => {
    expect(createRoleBody.parse(valid)).toEqual({
      description: "Configure domains",
      key: "custom-admin",
      name: "Custom",
      permissions: ["domain:administer"],
    });
    expect(updateRoleBody.parse(valid)).not.toHaveProperty("key");
  });

  test("name each rule in its own sentence", () => {
    expect(message({ ...valid, description: " " })).toBe(
      "Description is required.",
    );
    expect(message({ ...valid, name: "x".repeat(81) })).toBe(
      "Role name must be 80 characters or fewer.",
    );
    expect(message({ ...valid, key: "Custom--admin" })).toBe(
      "Role key must use lowercase letters, numbers, and single hyphens.",
    );
    expect(message({ ...valid, permissions: [] })).toBe(
      "Choose at least one permission.",
    );
    expect(message({ ...valid, permissions: ["domain:delete"] })).toBe(
      "The role contains an unknown permission.",
    );
  });
});

test("an emergency needs a reason of at most 240 characters", () => {
  const body = { organizationId: "o", permission: "p", scope: "subsidiary" };
  expect(breakGlassBody.safeParse(body).error?.issues[0]!.message).toBe(
    "Reason is required.",
  );
  expect(
    breakGlassBody.safeParse({ ...body, reason: "x".repeat(241) }).error
      ?.issues[0]!.message,
  ).toBe("Reason must be 240 characters or fewer.");
});

test("a review needs a decision and evidence of 10 to 500 characters", () => {
  const valid = {
    decision: "confirmed",
    note: "Manager approved, case 12",
  } as const;
  expect(reviewAccessBody.parse(valid)).toEqual(valid);
  expect(
    reviewAccessBody.safeParse({ ...valid, decision: "maybe" }).error
      ?.issues[0]!.message,
  ).toBe("Choose confirmed or flagged.");
  expect(
    reviewAccessBody.safeParse({ ...valid, note: " short " }).error?.issues[0]!
      .message,
  ).toBe("Record the review evidence in 10 to 500 characters.");
  expect(reviewKindParam.safeParse("other").error?.issues[0]!.message).toBe(
    "Unknown review type.",
  );
});
