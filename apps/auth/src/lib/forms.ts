import * as z from "zod";

import { MIN_PASSWORD_LENGTH } from "./auth-client";

/**
 * Field-level rules for the two credential forms. Kept out of the route files so
 * the wording of every error is in one place and testable without a DOM.
 */

export const signInSchema = z.object({
  email: z.email("Enter the email your account uses."),
  password: z.string().min(1, "Enter your password."),
});

export const newPasswordSchema = z
  .object({
    current: z.string().min(1, "Enter the password from your welcome email."),
    password: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      ),
    confirm: z.string(),
  })
  // Cross-field rules run only once each field is individually valid, so a short
  // password reports its length before it is compared to anything.
  .refine((values) => values.password !== values.current, {
    message: "Choose something different from the temporary password.",
    path: ["password"],
  })
  .refine((values) => values.confirm === values.password, {
    message: "Passwords don't match.",
    path: ["confirm"],
  });

/**
 * shadcn's display rule for TanStack Form: a field shows its error only once the
 * person has touched it, and shows one message at a time.
 */
export function errorFor(meta: {
  isTouched: boolean;
  isValid: boolean;
  errors: Array<{ message?: string } | undefined>;
}): string | undefined {
  if (!meta.isTouched || meta.isValid) return undefined;
  return meta.errors.find((error) => error?.message)?.message;
}
