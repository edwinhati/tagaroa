import { describe, expect, mock, test } from "bun:test";

import {
  fetchSession,
  sessionQueryOptions,
  signInDestination,
  type SessionState,
} from "./session";

const signedOut: SessionState = null;
const settled: SessionState = { user: { mustChangePassword: false } };
const issued: SessionState = { user: { mustChangePassword: true } };

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

  test("treats a session without the flag as settled", () => {
    expect(signInDestination({ user: {} })).toEqual({ to: "workspace" });
  });
});

test("loads a session once and treats request failures as signed out", async () => {
  const getSession = mock<() => Promise<{ data: unknown }>>()
    .mockResolvedValueOnce({ data: issued })
    .mockRejectedValueOnce(new Error("offline"));

  expect(await fetchSession(getSession)).toEqual(issued);
  expect(await fetchSession(getSession)).toBeNull();
  expect(sessionQueryOptions.retry).toBe(false);
});
