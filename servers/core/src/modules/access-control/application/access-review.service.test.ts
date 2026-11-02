import { expect, test } from "bun:test";

import type {
  AccessControlRepository,
  AssignmentView,
} from "../domain/repositories/access-control.repository";
import type {
  BusinessAccessReview,
  EmergencyAccessRecord,
} from "../domain/repositories/access-review.repository";
import { AccessReviewService } from "./access-review.service";

const now = new Date();
const assignment: AssignmentView = {
  id: "assignment",
  userId: "employee",
  grantedBy: "grantor",
  grantedAt: now,
  expiresAt: null,
  organizationId: "subsidiary",
  teamId: "team",
  roleId: "role",
  revokedAt: null,
  active: true,
  inactiveReason: null,
  role: {
    id: "role",
    key: "domain-admin",
    name: "Domain administrator",
    description: "Configuration",
    system: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    permissions: ["domain:administer"],
  },
};
const emergency: EmergencyAccessRecord = {
  id: "emergency",
  userId: "operator",
  organizationId: "subsidiary",
  teamId: "team",
  permission: "domain:administer",
  reason: "Restore service",
  activatedAt: now,
  expiresAt: new Date(now.getTime() - 1),
  endedAt: null,
};

const fixture = (
  assignments: AssignmentView[] = [assignment],
  emergencies: EmergencyAccessRecord[] = [emergency],
) => {
  const records: BusinessAccessReview[] = [];
  const events: string[] = [];
  const access = {
    listAssignments: async () => assignments,
  } as AccessControlRepository;
  const service = new AccessReviewService(
    access,
    {
      list: async () => records,
      emergencies: async () => emergencies,
      record: async (review) => {
        records.push(review);
      },
    },
    {
      recent: async () => [],
      record: async (event) => {
        events.push(event.type);
      },
    },
  );
  return { service, records, events };
};

test("reviews require independence, evidence and the displayed version", async () => {
  const { service, records, events } = fixture();
  const subject = (await service.list()).find(
    (row) => row.kind === "assignment",
  )!;
  const input = {
    decision: "confirmed",
    note: "Manager approved in case 123",
    snapshot: subject.snapshot,
  };
  for (const reviewer of ["employee", "grantor"])
    await expect(
      service.record("assignment", subject.id, input, { id: reviewer }),
    ).rejects.toThrow("reviewer other than");
  await expect(
    service.record(
      "assignment",
      subject.id,
      { ...input, snapshot: "old" },
      { id: "reviewer" },
    ),
  ).rejects.toThrow("Access changed");
  await expect(
    service.record(
      "assignment",
      subject.id,
      { ...input, note: "" },
      { id: "reviewer" },
    ),
  ).rejects.toThrow("evidence");
  await expect(
    service.record("assignment", subject.id, input, {
      id: "reviewer",
      impersonatedBy: "grantor",
    }),
  ).rejects.toThrow("your own");
  expect(records).toHaveLength(0);
  await service.record("assignment", subject.id, input, { id: "reviewer" });
  expect((await service.list())[0]!.review?.decision).toBe("confirmed");
  expect(events).toEqual(["access.assignment.reviewed"]);
  const nextWeek = new Date(now.getTime() + 8 * 86400_000);
  expect((await service.list(nextWeek))[0]!.review).toBeNull();
  const original = assignment.expiresAt;
  try {
    assignment.expiresAt = nextWeek;
    expect((await service.list())[0]!.review).toBeNull();
  } finally {
    assignment.expiresAt = original;
  }
});

test("list excludes revoked assignments and marks eligibility at emergency expiry", async () => {
  const at = new Date("2026-10-21T12:00:00Z");
  const { service } = fixture(
    [
      assignment,
      { ...assignment, id: "revoked", revokedAt: at },
      {
        ...assignment,
        id: "expired",
        active: false,
        inactiveReason: "expired",
        expiresAt: at,
      },
    ],
    [
      { ...emergency, id: "running", expiresAt: new Date(at.getTime() + 1) },
      { ...emergency, id: "boundary", expiresAt: at },
      {
        ...emergency,
        id: "ended",
        expiresAt: new Date(at.getTime() + 1),
        endedAt: at,
      },
    ],
  );
  const subjects = await service.list(at);
  expect(subjects.map((subject) => [subject.id, subject.eligible])).toEqual([
    [assignment.id, true],
    ["expired", false],
    ["running", false],
    ["boundary", true],
    ["ended", true],
  ]);
  expect(subjects[0]).toMatchObject({
    kind: "assignment",
    label: assignment.role.name,
    detail: "No expiration",
    userId: assignment.userId,
    grantedBy: assignment.grantedBy,
  });
  expect(subjects[1]!.detail).toBe(`Expires ${at.toISOString()}`);
  expect(subjects[2]).toMatchObject({
    kind: "emergency",
    label: emergency.permission,
    detail: emergency.reason,
    grantedBy: null,
  });
});

test("list accepts only independent matching reviews from the current UTC week", async () => {
  const at = new Date("2026-10-21T12:00:00Z");
  const monday = new Date("2026-10-19T00:00:00Z");
  const { service, records } = fixture();
  const subjects = await service.list(at);
  const subject = subjects.find((row) => row.kind === "assignment")!;
  const review: BusinessAccessReview = {
    id: "review",
    kind: "assignment",
    subjectId: subject.id,
    snapshot: subject.snapshot,
    decision: "confirmed",
    note: "Approved by the manager",
    reviewedAt: monday,
    reviewedBy: "reviewer",
  };
  for (const candidate of [
    { ...review, reviewedBy: assignment.userId },
    { ...review, reviewedBy: assignment.grantedBy },
    { ...review, reviewedBy: null },
    { ...review, snapshot: "stale" },
    { ...review, reviewedAt: new Date(monday.getTime() - 1) },
    { ...review, subjectId: "different-assignment" },
    { ...review, kind: "emergency" as const },
  ]) {
    records.splice(0, records.length, candidate);
    expect(
      (await service.list(at)).find((row) => row.kind === "assignment")!.review,
    ).toBeNull();
  }
  records.splice(0, records.length, review);
  expect(
    (await service.list(at)).find((row) => row.kind === "assignment")!.review,
  ).toEqual(review);
  expect(
    (await service.list(new Date("2026-10-26T00:00:00Z"))).find(
      (row) => row.kind === "assignment",
    )!.review,
  ).toBeNull();
});

test("emergency access is independently reviewed only after completion", async () => {
  const { service } = fixture();
  const subject = (await service.list()).find(
    (row) => row.kind === "emergency",
  )!;
  const input = {
    decision: "flagged",
    note: "Investigate the incident scope",
    snapshot: subject.snapshot,
  };
  await expect(
    service.record("emergency", subject.id, input, { id: "operator" }),
  ).rejects.toThrow("reviewer other than");
  const expires = emergency.expiresAt;
  try {
    emergency.expiresAt = new Date(Date.now() + 60_000);
    await expect(
      service.record("emergency", subject.id, input, { id: "reviewer" }),
    ).rejects.toThrow("completed emergency");
  } finally {
    emergency.expiresAt = expires;
  }
  await service.record("emergency", subject.id, input, { id: "reviewer" });
  expect(
    (await service.list(new Date(now.getTime() + 8 * 86400_000))).find(
      (row) => row.kind === "emergency",
    )!.review?.decision,
  ).toBe("flagged");
});
