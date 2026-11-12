import { objectBody, requiredText } from "@repo/contracts/requests/fields";
import * as z from "zod";

/** `PUT /directory/positions/...`: a title and an optional manager. */
export const savePositionBody = objectBody({
  // Key order is the order issues are reported in; title comes first.
  title: requiredText("Title", 120),
  // Absent, null, or "" mean no manager.
  managerUserId: z
    .string({ error: "Manager must be a person ID." })
    .nullish()
    .transform((value) => value || null),
});

export type SavePositionBody = z.output<typeof savePositionBody>;
