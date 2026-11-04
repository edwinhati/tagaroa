import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";

import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import { AccessReviewService } from "../../src/modules/access-control/application/access-review.service";
import { DrizzleAccessControlRepository } from "../../src/modules/access-control/infrastructure/persistence/drizzle/drizzle-access-control.repository";
import { DrizzleAccessReviewRepository } from "../../src/modules/access-control/infrastructure/persistence/drizzle/drizzle-access-review.repository";
import type { Database } from "../../src/platform/database/database.module";
import { prepareTestDatabase, testEnv } from "../database";

setDefaultTimeout(60_000);

const run = crypto.randomUUID().slice(0, 8);
const id = (name: string) => `${name}-${run}`;
let client: SQL;
let db: Database;
let service: AccessReviewService;

beforeAll(async () => {
  await prepareTestDatabase();
  client = new SQL(testEnv.DATABASE_URL);
  db = drizzle({ client }) as unknown as Database;
  service = new AccessReviewService(
    new DrizzleAccessControlRepository(db),
    new DrizzleAccessReviewRepository(db),
    { record: async () => {}, recent: async () => [] },
  );
  await client`insert into auth."user" (id, name, email, created_at, updated_at) values (${id("holder")}, 'Holder', ${`holder-${run}@tagaroa.test`}, now(), now()), (${id("reviewer")}, 'Reviewer', ${`reviewer-${run}@tagaroa.test`}, now(), now())`;
  await client`insert into auth.organization (id, name, slug, created_at) values (${id("org")}, 'Org', ${id("org")}, now())`;
});

afterAll(async () => {
  await client`delete from auth."user" where id in (${id("holder")}, ${id("reviewer")}, ${id("gone")})`;
  await client`delete from auth.organization where id = ${id("org")}`;
  await client.close();
});

const holder = id("holder");
const reviewer = { id: id("reviewer") };
const elevate = (name: string, daysAgo: number, ended = false) =>
  client`insert into access_control.break_glass_elevation (id, user_id, organization_id, scope_key, permission, reason, activated_at, expires_at, ended_at) values (${id(name)}, ${holder}, ${id("org")}, ${id("org")}, 'domain:administer', 'Fixture "quoted" — ünï', now() - ${daysAgo} * interval '1 day', now() - ${daysAgo} * interval '1 day' + interval '15 minutes', case when ${ended} then now() - ${daysAgo} * interval '1 day' + interval '5 minutes' end)`;
const decide = async (name: string, by = reviewer) => {
  const subject = (await service.list()).find((row) => row.id === id(name))!;
  return service.record(
    "emergency",
    id(name),
    {
      decision: "confirmed",
      note: "Reviewed against the incident",
      snapshot: subject.snapshot,
    },
    by,
  );
};
const listed = async () =>
  (await service.list())
    .filter((row) => row.id.endsWith(run))
    .map((row) => row.id.replace(`-${run}`, ""))
    .sort();

test("old emergencies leave the queue only on a review whose snapshot still holds", async () => {
  await elevate("recent", 1);
  await elevate("settled", 120);
  await elevate("ended", 120, true);
  await elevate("unreviewed", 120);
  await elevate("orphaned", 120);
  await elevate("self", 120);
  await elevate("superseded", 120);
  await elevate("raced", 120);
  await client`insert into auth."user" (id, name, email, created_at, updated_at) values (${id("gone")}, 'Gone', ${`gone-${run}@tagaroa.test`}, now(), now())`;

  await decide("recent");
  await decide("settled");
  await decide("ended");
  await decide("orphaned", { id: id("gone") });
  await client`delete from auth."user" where id = ${id("gone")}`;
  // The holder cannot settle their own elevation; the service refuses, so insert the row directly.
  await client`insert into access_control.access_review (id, kind, subject_id, snapshot, decision, note, reviewed_at, reviewed_by) values (${id("r-self")}, 'emergency', ${id("self")}, 'x', 'confirmed', 'Fixture note', now(), ${holder})`;
  // A valid review followed by a newer invalid one (reviewer later deleted): the newest decides.
  await decide("superseded");
  await client`insert into access_control.access_review (id, kind, subject_id, snapshot, decision, note, reviewed_at, reviewed_by) values (${id("r-newer")}, 'emergency', ${id("superseded")}, 'x', 'confirmed', 'Fixture note', clock_timestamp(), null)`;
  // ended_at changes after the service validated the subject but before the insert.
  const reviews = new DrizzleAccessReviewRepository(db);
  const raced = new AccessReviewService(
    new DrizzleAccessControlRepository(db),
    {
      latest: (subjects) => reviews.latest(subjects),
      emergencies: () => reviews.emergencies(),
      record: async (review) => {
        await client`update access_control.break_glass_elevation set ended_at = now() where id = ${id("raced")}`;
        await reviews.record(review);
      },
    },
    { record: async () => {}, recent: async () => [] },
  );
  const stale = (await raced.list()).find((row) => row.id === id("raced"))!;
  await raced.record(
    "emergency",
    id("raced"),
    {
      decision: "confirmed",
      note: "Reviewed against the incident",
      snapshot: stale.snapshot,
    },
    reviewer,
  );

  expect(await listed()).toEqual(
    ["orphaned", "raced", "recent", "self", "superseded", "unreviewed"].sort(),
  );
  expect(
    (await service.list()).find((row) => row.id === id("raced"))!.review,
  ).toBeNull();
  expect(
    (await service.list()).find((row) => row.id === id("recent"))!.review,
  ).not.toBeNull();
});
