import { describe, expect, test } from "bun:test";

import { signInOutcome, twoFactorFailure } from "./sign-in";

describe("signInOutcome", () => {
  test("a suspended or expired account leaves for the locked-out page", () => {
    // The failure sentence is ignored: the code decides where they go.
    expect(signInOutcome({ code: "BANNED_USER", failure: "x" })).toEqual({
      kind: "locked-out",
      reason: "suspended",
    });
    expect(
      signInOutcome({ code: "TEMPORARY_PASSWORD_EXPIRED", failure: "x" }),
    ).toEqual({ kind: "locked-out", reason: "expired" });
  });

  test("any other refusal stays on the form with its sentence", () => {
    expect(
      signInOutcome({ code: "INVALID_EMAIL_OR_PASSWORD", failure: "Nope." }),
    ).toEqual({ kind: "failure", failure: "Nope." });
  });

  test("a second factor wins over a password change", () => {
    expect(
      signInOutcome({
        data: { twoFactorRedirect: true, user: { mustChangePassword: true } },
      }),
    ).toEqual({ kind: "two-factor" });
  });

  test("an admin-issued password carries the session token to the next step", () => {
    expect(
      signInOutcome({
        data: { token: "t1", user: { mustChangePassword: true } },
      }),
    ).toEqual({ kind: "choose-password", token: "t1" });
  });

  test("a plain sign-in hands over the token, or empty when there is none", () => {
    expect(signInOutcome({ data: { token: "t2", user: {} } })).toEqual({
      kind: "signed-in",
      token: "t2",
    });
    expect(signInOutcome({ data: { token: 42 } })).toEqual({
      kind: "signed-in",
      token: "",
    });
    expect(signInOutcome({ data: null })).toEqual({
      kind: "signed-in",
      token: "",
    });
  });
});

describe("twoFactorFailure", () => {
  test("nothing to show when verification succeeded", () => {
    expect(twoFactorFailure({ data: {} })).toBeNull();
  });

  test("a spent challenge asks to sign in again", () => {
    for (const code of [
      "INVALID_TWO_FACTOR_COOKIE",
      "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
    ]) {
      expect(twoFactorFailure({ code, failure: "raw" })).toBe(
        "This verification is no longer valid. Sign in again.",
      );
    }
  });

  test("a wrong code keeps its own sentence", () => {
    expect(
      twoFactorFailure({ code: "INVALID_CODE", failure: "Wrong code." }),
    ).toBe("Wrong code.");
  });
});
