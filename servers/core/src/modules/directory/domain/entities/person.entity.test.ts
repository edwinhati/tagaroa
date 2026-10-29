import { describe, expect, test } from "bun:test";

import { ageInDays } from "./person.entity";
import { daysBefore, NOW } from "./person.fixture";

describe("ageInDays", () => {
  test("counts whole days", () => {
    expect(ageInDays(daysBefore(9.5), NOW)).toBe(9);
  });

  test("a future date is nought, never negative", () => {
    expect(ageInDays(new Date(NOW.getTime() + 60_000), NOW)).toBe(0);
  });
});
