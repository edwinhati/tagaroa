import {
  DISPLAY_NAME_MAX_LENGTH,
  EVIDENCE_LENGTH,
} from "@repo/contracts/identity";
import {
  evidenceText,
  NOT_AN_OBJECT,
  objectBody,
  requiredText as required,
} from "@repo/contracts/requests/fields";
import * as z from "zod";

// Recovery and offboarding keep a case reference in the audit trail.
const evidence = (label: string) =>
  evidenceText(
    `${label} must be ${EVIDENCE_LENGTH.min} to ${EVIDENCE_LENGTH.max} characters. Use a case reference, never secrets.`,
  );

const verified = (message: string) => z.literal(true, { error: message });

/** `POST /auth-management/users/:userId/factor-recovery`. */
export const requestRecoveryBody = objectBody({
  // Key order is the order issues are reported in.
  identityVerified: verified(
    "Verify identity independently before requesting recovery.",
  ),
  reason: evidence("Recovery reason"),
  evidence: evidence("Verification evidence"),
});
export type RequestRecoveryBody = z.output<typeof requestRecoveryBody>;

/** `POST /auth-management/recoveries/:id/approve`. */
export const approveRecoveryBody = objectBody({
  identityVerified: verified("Independently verify identity before approval."),
  evidence: evidence("Approval evidence"),
});
export type ApproveRecoveryBody = z.output<typeof approveRecoveryBody>;

/** `POST /auth-management/users/:userId/offboard`. */
export const offboardBody = objectBody({
  reason: evidence("Offboarding reason and case reference"),
});
export type OffboardBody = z.output<typeof offboardBody>;

/** `POST /auth-management/subsidiaries`. */
export const createSubsidiaryBody = objectBody({
  name: required("Name"),
  slug: required("Slug").regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain lowercase letters, numbers, and single hyphens only.",
  ),
});
export type CreateSubsidiaryBody = z.output<typeof createSubsidiaryBody>;

/** `POST /auth-management/subsidiaries/:organizationId/teams`. */
export const createTeamBody = objectBody({ name: required("Team name") });
export type CreateTeamBody = z.output<typeof createTeamBody>;

/** `POST /auth-management/subsidiaries/:organizationId/members`. */
export const addMemberBody = objectBody({
  role: z
    .literal("member", {
      error: "Only standard subsidiary membership may be assigned here.",
    })
    .optional(),
  userId: required("Person"),
  teamId: required("Team").optional(),
});
export type AddMemberBody = z.output<typeof addMemberBody>;

/**
 * Better Auth's own `POST /auth/update-user`, guarded in `auth.ts`. A person
 * may change their display name and nothing else: email and role are
 * admin-managed (ADR 0001), and the personal address is an admin's to set.
 */
export const updateProfileBody = z.strictObject(
  {
    name: required("Name").max(
      DISPLAY_NAME_MAX_LENGTH,
      `Name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    ),
  },
  {
    error: (issue) =>
      issue.code === "unrecognized_keys"
        ? "Only your name can be changed here."
        : NOT_AN_OBJECT,
  },
);
export type UpdateProfileBody = z.output<typeof updateProfileBody>;
