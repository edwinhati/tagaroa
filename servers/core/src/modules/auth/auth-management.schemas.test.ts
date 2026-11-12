import { describe, expect, test } from "bun:test";

import type { ZodType } from "zod";

import {
  addMemberBody,
  approveRecoveryBody,
  createSubsidiaryBody,
  createTeamBody,
  offboardBody,
  requestRecoveryBody,
  updateProfileBody,
} from "./auth-management.schemas";

const messageOf = (schema: ZodType, input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]!.message;
};

const caseNote = "  HR callback verified; case REC-123  ";

describe("requestRecoveryBody", () => {
  const valid = {
    identityVerified: true,
    reason: caseNote,
    evidence: caseNote,
  };
  const message = (input: unknown) => messageOf(requestRecoveryBody, input);

  test("trims the evidence and drops unknown keys", () => {
    expect(requestRecoveryBody.parse({ ...valid, extra: 1 })).toEqual({
      identityVerified: true,
      reason: caseNote.trim(),
      evidence: caseNote.trim(),
    });
  });

  test("keeps the sentences the service used, attestation first", () => {
    const unverified =
      "Verify identity independently before requesting recovery.";
    expect(message({ ...valid, identityVerified: false })).toBe(unverified);
    expect(message({})).toBe(unverified);
    expect(message({ ...valid, reason: "too short " })).toBe(
      "Recovery reason must be 10 to 500 characters. Use a case reference, never secrets.",
    );
    expect(message({ ...valid, evidence: "x".repeat(501) })).toBe(
      "Verification evidence must be 10 to 500 characters. Use a case reference, never secrets.",
    );
    expect(message("nope")).toBe("Request body must be a JSON object.");
  });
});

describe("approveRecoveryBody", () => {
  const message = (input: unknown) => messageOf(approveRecoveryBody, input);

  test("accepts a verified approval and ignores a reason", () => {
    expect(
      approveRecoveryBody.parse({
        identityVerified: true,
        evidence: caseNote,
        reason: "unused",
      }),
    ).toEqual({ identityVerified: true, evidence: caseNote.trim() });
  });

  test("keeps the sentences the service used", () => {
    expect(message({ identityVerified: "true", evidence: caseNote })).toBe(
      "Independently verify identity before approval.",
    );
    expect(message({ identityVerified: true, evidence: 12 })).toBe(
      "Approval evidence must be 10 to 500 characters. Use a case reference, never secrets.",
    );
  });
});

describe("offboardBody", () => {
  test("keeps only the reason", () => {
    expect(
      offboardBody.parse({
        reason: caseNote,
        evidence: "",
        identityVerified: false,
      }),
    ).toEqual({ reason: caseNote.trim() });
    expect(messageOf(offboardBody, {})).toBe(
      "Offboarding reason and case reference must be 10 to 500 characters. Use a case reference, never secrets.",
    );
  });
});

describe("createSubsidiaryBody", () => {
  const message = (input: unknown) => messageOf(createSubsidiaryBody, input);

  test("trims name and slug", () => {
    expect(
      createSubsidiaryBody.parse({ name: " QA ", slug: " qa-group-1 " }),
    ).toEqual({ name: "QA", slug: "qa-group-1" });
  });

  test("keeps the sentences the controller helpers used", () => {
    expect(message({ slug: "qa" })).toBe("Name is required.");
    expect(message({ name: "QA", slug: " " })).toBe("Slug is required.");
    for (const slug of ["Invalid slug", "qa--group", "-qa", "qa_group"])
      expect(message({ name: "QA", slug })).toBe(
        "Slug must contain lowercase letters, numbers, and single hyphens only.",
      );
  });
});

describe("createTeamBody", () => {
  test("trims the name and requires one", () => {
    expect(createTeamBody.parse({ name: " QA team " })).toEqual({
      name: "QA team",
    });
    expect(messageOf(createTeamBody, { name: "" })).toBe(
      "Team name is required.",
    );
    expect(messageOf(createTeamBody, undefined)).toBe(
      "Request body must be a JSON object.",
    );
  });
});

describe("addMemberBody", () => {
  const message = (input: unknown) => messageOf(addMemberBody, input);

  test("role and team are optional; ids are trimmed", () => {
    expect(addMemberBody.parse({ userId: " u-1 " })).toEqual({ userId: "u-1" });
    expect(
      addMemberBody.parse({
        organizationId: "org-1",
        role: "member",
        teamId: " t-1 ",
        userId: "u-1",
      }),
    ).toEqual({ role: "member", teamId: "t-1", userId: "u-1" });
  });

  test("keeps the sentences the controller used, role first", () => {
    const standardOnly =
      "Only standard subsidiary membership may be assigned here.";
    expect(message({ role: "owner" })).toBe(standardOnly);
    expect(message({ role: null, userId: "u-1" })).toBe(standardOnly);
    expect(message({ userId: " " })).toBe("Person is required.");
    expect(message({ userId: "u-1", teamId: null })).toBe("Team is required.");
    expect(message({ userId: "u-1", teamId: "" })).toBe("Team is required.");
  });
});

describe("updateProfileBody", () => {
  const message = (input: unknown) => messageOf(updateProfileBody, input);

  test("trims the name", () => {
    expect(updateProfileBody.parse({ name: "  Ada Lovelace " })).toEqual({
      name: "Ada Lovelace",
    });
  });

  test("requires a name of at most 80 characters", () => {
    expect(message({ name: "   " })).toBe("Name is required.");
    expect(message({})).toBe("Name is required.");
    expect(message({ name: "a".repeat(81) })).toBe(
      "Name must be 80 characters or fewer.",
    );
    expect(message({ name: "a".repeat(80) })).toBeUndefined();
  });

  test("refuses every admin-managed field", () => {
    for (const field of ["email", "role", "personalEmail", "image"])
      expect(message({ name: "Ada", [field]: "x" })).toBe(
        "Only your name can be changed here.",
      );
    expect(message("Ada")).toBe("Request body must be a JSON object.");
  });
});
