import { expect, test } from "bun:test";

import { isFresh, temporaryPasswordExpired } from "./session-policy";

test("a sign-in is fresh for fifteen minutes, and never from the future", () => {
  const now = new Date("2026-08-31T12:00:00Z");
  expect(isFresh(new Date("2026-08-31T11:46:00Z"), now)).toBe(true);
  expect(isFresh(new Date("2026-08-31T11:45:00Z"), now)).toBe(false);
  expect(isFresh(new Date("2026-08-31T12:01:00Z"), now)).toBe(false);
  expect(isFresh(undefined, now)).toBe(false);
  expect(isFresh("not a date", now)).toBe(false);
});

test("a temporary password expires only while it still has to be replaced", () => {
  const now = Date.UTC(2026, 10, 5);
  const past = new Date(now - 1);
  expect(
    temporaryPasswordExpired(
      { mustChangePassword: true, temporaryPasswordExpiresAt: past },
      now,
    ),
  ).toBe(true);
  expect(
    temporaryPasswordExpired(
      {
        mustChangePassword: true,
        temporaryPasswordExpiresAt: past.toISOString(),
      },
      now,
    ),
  ).toBe(true);
  for (const user of [
    { mustChangePassword: false, temporaryPasswordExpiresAt: past },
    { mustChangePassword: true, temporaryPasswordExpiresAt: null },
    { mustChangePassword: true, temporaryPasswordExpiresAt: new Date(now + 1) },
    undefined,
  ])
    expect(temporaryPasswordExpired(user, now)).toBe(false);
});
