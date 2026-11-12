import { describe, expect, test } from "bun:test";

import { reviewWeekStart } from "@repo/contracts/identity";

import { AccessReview } from "../entities/access-review.entity";
import { daysBefore, NOW, person } from "../entities/person.fixture";
import { privilegedAccess } from "./privileged-access.service";

const reviewedAt = (iso: string, userId = "u1") =>
  AccessReview.restore({
    reviewedAt: new Date(iso),
    reviewedBy: "reviewer",
    userId,
  });

describe("privilegedAccess", () => {
  const week = reviewWeekStart(NOW);
  const admin = person({ role: "admin", updatedAt: daysBefore(30) });

  test("lists only unbanned privileged people", () => {
    const rows = privilegedAccess(
      [
        admin,
        person({ id: "u2", role: "user" }),
        person({ banned: true, id: "u3", role: "super-admin" }),
      ],
      [],
      week,
    );
    expect(rows.map((row) => row.userId)).toEqual(["u1"]);
  });

  test("a confirmation from this week counts", () => {
    const [row] = privilegedAccess(
      [admin],
      [reviewedAt("2026-03-10T12:00:00.000Z")],
      week,
    );
    expect(row!.reviewed).toBe(true);
  });

  test("a confirmation from last week does not", () => {
    const [row] = privilegedAccess(
      [admin],
      [reviewedAt("2026-03-06T12:00:00.000Z")],
      week,
    );
    expect(row!.reviewed).toBe(false);
  });

  test("a role edit since the confirmation puts them back in the queue", () => {
    const review = reviewedAt("2026-03-10T12:00:00.000Z");
    const [row] = privilegedAccess(
      [
        person({
          role: "super-admin",
          updatedAt: new Date("2026-03-11T08:00:00.000Z"),
        }),
      ],
      [review],
      week,
    );
    expect(row!.reviewed).toBe(false);
    // The stale confirmation is still shown, so an operator can see how stale.
    expect(row!.reviewedAt).toEqual(review.reviewedAt);
  });

  test("someone never reviewed reads as unreviewed, not as missing", () => {
    const [row] = privilegedAccess([admin], [], week);
    expect(row).toMatchObject({ reviewed: false, reviewedAt: null });
  });
});

test("historical self-reviews and reviews without an accountable reviewer do not count", () => {
  const admin = person({ role: "admin", updatedAt: daysBefore(30) });
  for (const reviewedBy of [admin.id, null]) {
    const [row] = privilegedAccess(
      [admin],
      [
        AccessReview.restore({
          userId: admin.id,
          reviewedBy,
          reviewedAt: NOW,
        }),
      ],
      reviewWeekStart(NOW),
    );
    expect(row!.reviewed).toBe(false);
  }
});
