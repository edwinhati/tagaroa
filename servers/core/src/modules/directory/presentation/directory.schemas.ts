import * as z from "zod";

/** `PUT /directory/positions/...`: a title and an optional manager. */
export const savePositionBody = z.object(
  {
    // Key order is the order issues are reported in; title comes first.
    title: z
      .string({ error: "Title is required." })
      .trim()
      .min(1, "Title is required.")
      .max(120, "Title must be 120 characters or fewer."),
    // Absent, null, or "" mean no manager.
    managerUserId: z
      .string({ error: "Manager must be a person ID." })
      .nullish()
      .transform((value) => value || null),
  },
  { error: "Request body must be a JSON object." },
);

export type SavePositionBody = z.output<typeof savePositionBody>;
