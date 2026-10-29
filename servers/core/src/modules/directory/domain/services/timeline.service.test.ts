import { describe, expect, test } from "bun:test";

import { NOW, person } from "../entities/person.fixture";
import { timeline } from "./timeline.service";

describe("timeline", () => {
  const people = [person(), person({ email: "grace@example.com", id: "u2" })];

  test("merges the trail and the sign-in log, newest first", () => {
    const entries = timeline(
      [
        {
          actorId: "u1",
          createdAt: new Date("2026-03-11T10:00:00.000Z"),
          detail: null,
          id: "e1",
          targetUserId: "u2",
          type: "user.banned",
        },
      ],
      [
        {
          at: new Date("2026-03-12T08:00:00.000Z"),
          id: "s1",
          ipAddress: "10.0.0.1",
          userId: "u2",
        },
      ],
      people,
    );

    expect(entries.map((entry) => entry.id)).toEqual(["session:s1", "e1"]);
    expect(entries[0]).toMatchObject({
      actor: "Authentication service",
      detail: "10.0.0.1",
      target: "grace@example.com",
      type: "user.signed-in",
    });
    expect(entries[1]).toMatchObject({
      actor: "ada@example.com",
      target: "grace@example.com",
    });
  });

  test("an event outlives the people it names", () => {
    const [entry] = timeline(
      [
        {
          actorId: "gone",
          createdAt: NOW,
          detail: "also-gone",
          id: "e1",
          targetUserId: "gone-too",
          type: "user.deleted",
        },
      ],
      [],
      people,
    );
    expect(entry).toMatchObject({
      actor: "Deleted operator",
      // Falls back to the detail, which is where a deleted target's id is kept.
      target: "also-gone",
    });
  });

  test("an act by HR is attributed to HR, not to a deleted operator", () => {
    const [issued, removed] = timeline(
      [
        {
          actorId: null,
          createdAt: NOW,
          detail: "grace@example.com from Frappe HR HR-EMP-00001",
          id: "e1",
          targetUserId: "u2",
          type: "user.created",
        },
        {
          actorId: null,
          createdAt: new Date(NOW.getTime() - 1),
          detail: "Former operator's grant",
          id: "e2",
          targetUserId: "u2",
          type: "user.role.updated",
        },
      ],
      [],
      people,
    );
    expect(issued).toMatchObject({ actor: "Frappe HR" });
    expect(removed).toMatchObject({ actor: "Deleted operator" });
  });

  test("keeps the newest of the merge, not the newest of each source", () => {
    const at = (minute: number) =>
      new Date(Date.UTC(2026, 2, 12, 8, minute, 0));
    const entries = timeline(
      Array.from({ length: 3 }, (_, index) => ({
        actorId: "u1",
        createdAt: at(index * 2),
        detail: null,
        id: `e${index}`,
        targetUserId: "u2",
        type: "user.banned",
      })),
      Array.from({ length: 3 }, (_, index) => ({
        at: at(index * 2 + 1),
        id: `s${index}`,
        ipAddress: null,
        userId: "u2",
      })),
      people,
      3,
    );

    expect(entries.map((entry) => entry.id)).toEqual([
      "session:s2",
      "e2",
      "session:s1",
    ]);
  });

  test("a sign-in by someone since deleted still reads", () => {
    const [entry] = timeline(
      [],
      [{ at: NOW, id: "s1", ipAddress: null, userId: "gone" }],
      people,
    );
    expect(entry!.target).toBe("Deleted person");
  });
});
