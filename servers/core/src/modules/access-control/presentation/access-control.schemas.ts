import { WORKING_DOMAINS } from "@repo/contracts";
import { EVIDENCE_LENGTH } from "@repo/contracts/identity";
import * as z from "zod";

import {
  evidenceText,
  objectBody,
  requiredText as required,
} from "../../../platform/http/request-fields";
import {
  ACCESS_SCOPE_TYPES,
  type AccessScopeType,
  isPermissionKey,
  type PermissionKey,
} from "../domain/access-policy";
import {
  REVIEW_DECISIONS,
  REVIEW_KINDS,
} from "../domain/repositories/access-review.repository";

const scope = z.enum(ACCESS_SCOPE_TYPES, {
  error: "Scope must be subsidiary or team.",
});

const EXPIRATION_MESSAGE = "Expiration must be an ISO date and time.";

// Absent, null, or "" mean no expiry; anything else must parse as a date.
const expiration = z
  .unknown()
  .optional()
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "string" ? new Date(value) : undefined;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: EXPIRATION_MESSAGE });
      return z.NEVER;
    }
    return parsed;
  });

// A team scope needs a team; any other scope drops one.
const teamForScope = <T extends { scope: AccessScopeType; teamId?: unknown }>(
  body: T,
  ctx: z.RefinementCtx,
) => {
  if (body.scope !== "team") return { ...body, teamId: null };
  const team = required("Team").safeParse(body.teamId);
  if (!team.success) {
    ctx.addIssue({
      code: "custom",
      message: "Team is required.",
      path: ["teamId"],
    });
    return z.NEVER;
  }
  return { ...body, teamId: team.data };
};

/** `POST /access-control/assignments`: the input `grantAssignment` takes. */
export const grantAssignmentBody = objectBody({
  // Key order is the order issues are reported in; scope comes first.
  scope,
  expiresAt: expiration,
  organizationId: required("Subsidiary"),
  roleId: required("Role"),
  teamId: z.unknown().optional(),
  userId: required("Person"),
}).transform(teamForScope);

export type GrantAssignmentBody = z.output<typeof grantAssignmentBody>;

/** `PATCH /access-control/assignments/:assignmentId`. */
export const updateAssignmentBody = objectBody({ expiresAt: expiration });

export type UpdateAssignmentBody = z.output<typeof updateAssignmentBody>;

/** `POST /access-control/break-glass`: the input `activateBreakGlass` takes. */
export const breakGlassBody = objectBody({
  scope,
  organizationId: required("Subsidiary"),
  permission: required("Permission"),
  reason: required("Reason", 240),
  teamId: z.unknown().optional(),
}).transform(teamForScope);

export type BreakGlassBody = z.output<typeof breakGlassBody>;

const CHOOSE_PERMISSIONS = "Choose at least one permission.";

// Repeats collapse; anything outside the catalogue is refused.
const permissions = z
  .array(z.unknown(), { error: CHOOSE_PERMISSIONS })
  .min(1, CHOOSE_PERMISSIONS)
  .transform((values) => [...new Set(values)])
  .refine(
    (values): values is PermissionKey[] =>
      values.every(
        (value) => typeof value === "string" && isPermissionKey(value),
      ),
    "The role contains an unknown permission.",
  );

/** `POST /access-control/roles`. */
export const createRoleBody = objectBody({
  description: required("Description", 240),
  key: required("Role key", 64).regex(
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
    "Role key must use lowercase letters, numbers, and single hyphens.",
  ),
  name: required("Role name", 80),
  permissions,
});

export type CreateRoleBody = z.output<typeof createRoleBody>;

/** `PATCH /access-control/roles/:roleId`. The key never changes. */
export const updateRoleBody = createRoleBody.omit({ key: true });

export type UpdateRoleBody = z.output<typeof updateRoleBody>;

/** `POST /access-control/reviews/:kind/:subjectId`. */
export const reviewKindParam = z.enum(REVIEW_KINDS, {
  error: "Unknown review type.",
});

export const reviewAccessBody = objectBody({
  decision: z.enum(REVIEW_DECISIONS, {
    error: "Choose confirmed or flagged.",
  }),
  note: evidenceText(
    `Record the review evidence in ${EVIDENCE_LENGTH.min} to ${EVIDENCE_LENGTH.max} characters.`,
  ),
  // Compared with the subject as it stands; any other value is a stale read.
  snapshot: z.unknown().optional(),
});

export type ReviewAccessBody = z.output<typeof reviewAccessBody>;

/** `PUT /access-control/teams/:teamId/domain`: a domain slug, or null for none. */
export const bindDomainBody = objectBody({
  domainSlug: z
    .enum(
      WORKING_DOMAINS.map((domain) => domain.slug),
      { error: "Choose a known domain or no domain." },
    )
    .nullable(),
});

export type BindDomainBody = z.output<typeof bindDomainBody>;

/** `GET /access-control/me` query. A blank or repeated team means none. */
export const myPermissionsQuery = z.object({
  organizationId: required("Subsidiary"),
  teamId: z
    .unknown()
    .optional()
    .transform((value) =>
      typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : null,
    ),
});

export type MyPermissionsQuery = z.output<typeof myPermissionsQuery>;
