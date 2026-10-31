import * as z from "zod";

import { ACCESS_SCOPE_TYPES } from "../domain/access-policy";

const required = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`);

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

/** `POST /access-control/assignments`: the input `grantAssignment` takes. */
export const grantAssignmentBody = z
  .object(
    {
      // Key order is the order issues are reported in; scope comes first.
      scope: z.enum(ACCESS_SCOPE_TYPES, {
        error: "Scope must be subsidiary or team.",
      }),
      expiresAt: expiration,
      organizationId: required("Subsidiary"),
      roleId: required("Role"),
      teamId: z.unknown().optional(),
      userId: required("Person"),
    },
    { error: "Request body must be a JSON object." },
  )
  .transform((body, ctx) => {
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
  });

export type GrantAssignmentBody = z.output<typeof grantAssignmentBody>;
