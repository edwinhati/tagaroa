import { describe, expect, test } from "bun:test";

import type { SessionState } from "@repo/shell/session-state";

import { signInDestination } from "./session";

const signedOut: SessionState = null;
const settled: SessionState = { user: { mustChangePassword: false } };
const issued: SessionState = { user: { mustChangePassword: true } };
const unenrolledAdmin: SessionState = {
  user: {
    mustChangePassword: false,
    role: "admin",
    twoFactorEnabled: false,
  },
};

describe("signInDestination", () => {
  test("shows the form when nobody is signed in", () => {
    expect(signInDestination(signedOut)).toEqual({ to: "form" });
    expect(signInDestination(undefined)).toEqual({ to: "form" });
  });

  test("sends a signed-in operator on to the workspace", () => {
    expect(signInDestination(settled)).toEqual({ to: "workspace" });
  });

  test("sends an admin-issued password to be replaced first", () => {
    expect(signInDestination(issued)).toEqual({ to: "choose-password" });
  });

  test("requires privileged accounts to enroll after replacing a password", () => {
    expect(signInDestination(unenrolledAdmin)).toEqual({
      to: "secure-account",
    });
    expect(
      signInDestination({
        user: { role: "super-admin", twoFactorEnabled: true },
      }),
    ).toEqual({ to: "workspace" });
  });

  test("treats a session without the flag as settled", () => {
    expect(signInDestination({ user: {} })).toEqual({ to: "workspace" });
  });
});
