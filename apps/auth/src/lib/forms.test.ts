import { describe, expect, test } from "bun:test";

import { PASSWORD_LENGTH } from "@repo/contracts/identity";

import {
  errorFor as displayedErrorFor,
  newPasswordSchema,
  signInSchema,
} from "./forms";

/** First message zod reports for a field, or undefined when the field is fine. */
function errorFor(
  schema: {
    safeParse: (value: unknown) => {
      success: boolean;
      error?: { issues: Array<{ path: PropertyKey[]; message: string }> };
    };
  },
  value: unknown,
  field: string,
): string | undefined {
  const result = schema.safeParse(value);
  if (result.success) return undefined;
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message;
}

const long = "a".repeat(PASSWORD_LENGTH.min);

describe("signInSchema", () => {
  test("accepts an email and a password", () => {
    expect(
      signInSchema.safeParse({ email: "ana@tagaroa.com", password: "x" })
        .success,
    ).toBe(true);
  });

  test("rejects a value that is not an email", () => {
    expect(
      errorFor(signInSchema, { email: "ana", password: "x" }, "email"),
    ).toBe("Enter the email your account uses.");
  });

  test("rejects an empty password", () => {
    expect(
      errorFor(
        signInSchema,
        { email: "ana@tagaroa.com", password: "" },
        "password",
      ),
    ).toBe("Enter your password.");
  });
});

describe("newPasswordSchema", () => {
  const valid = { current: "issued-one", password: long, confirm: long };

  test("accepts a long new password confirmed twice", () => {
    expect(newPasswordSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects a new password under the minimum length", () => {
    const short = "a".repeat(PASSWORD_LENGTH.min - 1);
    expect(
      errorFor(
        newPasswordSchema,
        { ...valid, password: short, confirm: short },
        "password",
      ),
    ).toBe(`Use at least ${PASSWORD_LENGTH.min} characters.`);
  });

  test("rejects reusing the temporary password", () => {
    expect(
      errorFor(
        newPasswordSchema,
        { current: long, password: long, confirm: long },
        "password",
      ),
    ).toBe("Choose something different from the temporary password.");
  });

  test("rejects a confirmation that does not match", () => {
    expect(
      errorFor(newPasswordSchema, { ...valid, confirm: `${long}z` }, "confirm"),
    ).toBe("Passwords don't match.");
  });

  test("rejects an empty temporary password", () => {
    expect(
      errorFor(newPasswordSchema, { ...valid, current: "" }, "current"),
    ).toBe("Enter the password from your welcome email.");
  });
});

test("shows only the first message for a touched invalid field", () => {
  expect(
    displayedErrorFor({
      errors: [undefined, { message: "Enter your password." }],
      isTouched: true,
      isValid: false,
    }),
  ).toBe("Enter your password.");
  expect(
    displayedErrorFor({ errors: [], isTouched: false, isValid: false }),
  ).toBeUndefined();
  expect(
    displayedErrorFor({ errors: [], isTouched: true, isValid: true }),
  ).toBeUndefined();
});
