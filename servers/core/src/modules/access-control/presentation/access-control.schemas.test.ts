import { describe, expect, test } from "bun:test";

import { grantAssignmentBody } from "./access-control.schemas";

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
