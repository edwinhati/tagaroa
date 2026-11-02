import * as z from "zod";

const NOT_AN_OBJECT = "Request body must be a JSON object.";

const required = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`);

// Recovery and offboarding keep a case reference in the audit trail.
const evidence = (label: string) => {
  const message = `${label} must be 10 to 500 characters. Use a case reference, never secrets.`;
  return z.string({ error: message }).trim().min(10, message).max(500, message);
};

const verified = (message: string) => z.literal(true, { error: message });

/** `POST /auth-management/users/:userId/factor-recovery`. */
export const requestRecoveryBody = z.object(
  {
    // Key order is the order issues are reported in.
    identityVerified: verified(
      "Verify identity independently before requesting recovery.",
    ),
    reason: evidence("Recovery reason"),
    evidence: evidence("Verification evidence"),
  },
  { error: NOT_AN_OBJECT },
);
export type RequestRecoveryBody = z.output<typeof requestRecoveryBody>;

/** `POST /auth-management/recoveries/:id/approve`. */
export const approveRecoveryBody = z.object(
  {
    identityVerified: verified(
      "Independently verify identity before approval.",
    ),
    evidence: evidence("Approval evidence"),
  },
  { error: NOT_AN_OBJECT },
);
export type ApproveRecoveryBody = z.output<typeof approveRecoveryBody>;

/** `POST /auth-management/users/:userId/offboard`. */
export const offboardBody = z.object(
  { reason: evidence("Offboarding reason and case reference") },
  { error: NOT_AN_OBJECT },
);
export type OffboardBody = z.output<typeof offboardBody>;

/** `POST /auth-management/subsidiaries`. */
export const createSubsidiaryBody = z.object(
  {
    name: required("Name"),
    slug: required("Slug").regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain lowercase letters, numbers, and single hyphens only.",
    ),
  },
  { error: NOT_AN_OBJECT },
);
export type CreateSubsidiaryBody = z.output<typeof createSubsidiaryBody>;

/** `POST /auth-management/subsidiaries/:organizationId/teams`. */
export const createTeamBody = z.object(
  { name: required("Team name") },
  { error: NOT_AN_OBJECT },
);
export type CreateTeamBody = z.output<typeof createTeamBody>;

/** `POST /auth-management/subsidiaries/:organizationId/members`. */
export const addMemberBody = z.object(
  {
    role: z
      .literal("member", {
        error: "Only standard subsidiary membership may be assigned here.",
      })
      .optional(),
    userId: required("Person"),
    teamId: required("Team").optional(),
  },
  { error: NOT_AN_OBJECT },
);
export type AddMemberBody = z.output<typeof addMemberBody>;

/**
 * Better Auth's own `POST /auth/update-user`, guarded in `auth.ts`. A person
 * may change their display name and nothing else: email and role are
 * admin-managed (ADR 0001), and the personal address is an admin's to set.
 */
export const updateProfileBody = z.strictObject(
  {
    name: required("Name").max(80, "Name must be 80 characters or fewer."),
  },
  {
    error: (issue) =>
      issue.code === "unrecognized_keys"
        ? "Only your name can be changed here."
        : NOT_AN_OBJECT,
  },
);
export type UpdateProfileBody = z.output<typeof updateProfileBody>;
