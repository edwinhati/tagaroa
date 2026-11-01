import * as z from "zod";

import {
  ACCESS_SCOPE_TYPES,
  type AccessScopeType,
} from "../domain/access-policy";

const required = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`);

const OBJECT_BODY = { error: "Request body must be a JSON object." };

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
export const grantAssignmentBody = z
  .object(
    {
      // Key order is the order issues are reported in; scope comes first.
      scope,
      expiresAt: expiration,
      organizationId: required("Subsidiary"),
      roleId: required("Role"),
      teamId: z.unknown().optional(),
      userId: required("Person"),
    },
    OBJECT_BODY,
  )
  .transform(teamForScope);

export type GrantAssignmentBody = z.output<typeof grantAssignmentBody>;

/** `PATCH /access-control/assignments/:assignmentId`. */
export const updateAssignmentBody = z.object(
  { expiresAt: expiration },
  OBJECT_BODY,
);

export type UpdateAssignmentBody = z.output<typeof updateAssignmentBody>;

/** `POST /access-control/break-glass`: the input `activateBreakGlass` takes. */
export const breakGlassBody = z
  .object(
    {
      scope,
      organizationId: required("Subsidiary"),
      permission: required("Permission"),
      // The service owns the reason's length rule.
      reason: z.unknown().optional(),
      teamId: z.unknown().optional(),
    },
    OBJECT_BODY,
  )
  .transform(teamForScope);

export type BreakGlassBody = z.output<typeof breakGlassBody>;

// The role and review fields are cleaned and checked in the service (trimmed
// text, key format, permission catalogue), so these schemas only fix the shape.
// Zod 4 rejects a missing `z.unknown()` key, so each is `.optional()`: an absent
// field reaches the service and gets its sentence, as before.

/** `POST /access-control/roles`. */
export const createRoleBody = z.object(
  {
    description: z.unknown().optional(),
    key: z.unknown().optional(),
    name: z.unknown().optional(),
    permissions: z.unknown().optional(),
  },
  OBJECT_BODY,
);

export type CreateRoleBody = z.output<typeof createRoleBody>;

/** `PATCH /access-control/roles/:roleId`. */
export const updateRoleBody = createRoleBody.omit({ key: true });

export type UpdateRoleBody = z.output<typeof updateRoleBody>;

/** `POST /access-control/reviews/:kind/:subjectId`. */
export const reviewAccessBody = z.object(
  {
    decision: z.unknown().optional(),
    note: z.unknown().optional(),
    snapshot: z.unknown().optional(),
  },
  OBJECT_BODY,
);

export type ReviewAccessBody = z.output<typeof reviewAccessBody>;

/** `PUT /access-control/teams/:teamId/domain`: a domain slug, or null for none. */
export const bindDomainBody = z.object(
  {
    domainSlug: z
      .string({ error: "Choose a known domain or no domain." })
      .nullable(),
  },
  OBJECT_BODY,
);

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
