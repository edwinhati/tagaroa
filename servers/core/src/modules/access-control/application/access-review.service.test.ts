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

const fixture = () => {
  const records: BusinessAccessReview[] = [];
  const events: string[] = [];
  const access = {
    listAssignments: async () => [assignment],
  } as AccessControlRepository;
  const service = new AccessReviewService(
    access,
    {
      list: async () => records,
      emergencies: async () => [emergency],
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
      service.record("assignment", subject.id, input, reviewer),
    ).rejects.toThrow("reviewer other than");
  await expect(
    service.record(
      "assignment",
      subject.id,
      { ...input, snapshot: "old" },
      "reviewer",
    ),
  ).rejects.toThrow("Access changed");
  await expect(
    service.record(
      "assignment",
      subject.id,
      { ...input, note: "" },
      "reviewer",
    ),
  ).rejects.toThrow("evidence");
  expect(records).toHaveLength(0);
  await service.record("assignment", subject.id, input, "reviewer");
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
    service.record("emergency", subject.id, input, "operator"),
  ).rejects.toThrow("reviewer other than");
  const expires = emergency.expiresAt;
  try {
    emergency.expiresAt = new Date(Date.now() + 60_000);
    await expect(
      service.record("emergency", subject.id, input, "reviewer"),
    ).rejects.toThrow("completed emergency");
  } finally {
    emergency.expiresAt = expires;
  }
  await service.record("emergency", subject.id, input, "reviewer");
  expect(
    (await service.list(new Date(now.getTime() + 8 * 86400_000))).find(
      (row) => row.kind === "emergency",
    )!.review?.decision,
  ).toBe("flagged");
});
