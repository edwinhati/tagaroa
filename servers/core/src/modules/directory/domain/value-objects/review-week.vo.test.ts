import { describe, expect, test } from "bun:test";

import { NOW } from "../entities/person.fixture";
import { ReviewWeek } from "./review-week.vo";

describe("ReviewWeek.containing", () => {
  test("is the Monday, at midnight UTC", () => {
    expect(ReviewWeek.containing(NOW).start.toISOString()).toBe(
      "2026-03-09T00:00:00.000Z",
    );
  });

  test("a Sunday belongs to the week that has just ended", () => {
    const sunday = new Date("2026-03-15T23:00:00.000Z");
    expect(ReviewWeek.containing(sunday).start.toISOString()).toBe(
      "2026-03-09T00:00:00.000Z",
    );
  });

  test("a Monday is its own week's start", () => {
    const monday = new Date("2026-03-09T00:00:01.000Z");
    expect(ReviewWeek.containing(monday).start.toISOString()).toBe(
      "2026-03-09T00:00:00.000Z",
    );
  });
});
