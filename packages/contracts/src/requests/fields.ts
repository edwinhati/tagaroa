import { EVIDENCE_LENGTH } from "@repo/contracts/identity";
import * as z from "zod";

export const NOT_AN_OBJECT = "Request body must be a JSON object.";

/** A request body object; anything else is refused with one sentence. */
export const objectBody = <Shape extends z.core.$ZodLooseShape>(shape: Shape) =>
  z.object(shape, { error: NOT_AN_OBJECT });

/** Trimmed, non-empty text, optionally capped, named in its sentences. */
export const requiredText = (label: string, maximum?: number) => {
  const text = z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`);
  return maximum === undefined
    ? text
    : text.max(maximum, `${label} must be ${maximum} characters or fewer.`);
};

/** The case reference recorded with a sensitive act, one sentence for every failure. */
export const evidenceText = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .min(EVIDENCE_LENGTH.min, message)
    .max(EVIDENCE_LENGTH.max, message);
