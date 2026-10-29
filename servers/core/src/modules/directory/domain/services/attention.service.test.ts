import { describe, expect, test } from "bun:test";

import { daysBefore, NOW, person } from "../entities/person.fixture";
import { attentionFor } from "./attention.service";

describe("attentionFor", () => {
  test("raises a temporary password", () => {
    const issues = attentionFor(
      [person({ mustChangePassword: true })],
      new Set(["u1"]),
      NOW,
    );
    expect(issues.map((issue) => issue.kind)).toEqual(["temporary-password"]);
  });

  test("gives an unverified address a week's grace, then raises it", () => {
    const fresh = person({ createdAt: daysBefore(6), emailVerified: false });
    expect(attentionFor([fresh], new Set(["u1"]), NOW)).toEqual([]);

    const stale = person({ createdAt: daysBefore(7), emailVerified: false });
    const issues = attentionFor([stale], new Set(["u1"]), NOW);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.kind).toBe("unverified-email");
    // Dated from the account, not from the last edit to it.
    expect(issues[0]!.ageDays).toBe(7);
  });

  test("raises someone who is in no subsidiary", () => {
    const issues = attentionFor([person()], new Set(), NOW);
    expect(issues.map((issue) => issue.kind)).toEqual(["no-subsidiary"]);
  });

  test("raises every issue a person has at once", () => {
    const troubled = person({
      createdAt: daysBefore(30),
      emailVerified: false,
      mustChangePassword: true,
    });
    expect(attentionFor([troubled], new Set(), NOW).map((i) => i.kind)).toEqual(
      ["temporary-password", "unverified-email", "no-subsidiary"],
    );
  });

  test("a banned account raises nothing: it is already the answer", () => {
    const banned = person({
      banned: true,
      createdAt: daysBefore(30),
      emailVerified: false,
      mustChangePassword: true,
    });
    expect(attentionFor([banned], new Set(), NOW)).toEqual([]);
  });
});
