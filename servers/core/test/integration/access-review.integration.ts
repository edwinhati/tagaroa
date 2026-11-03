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
let service: AccessReviewService;

beforeAll(async () => {
  await prepareTestDatabase();
  client = new SQL(testEnv.DATABASE_URL);
  const db = drizzle({ client }) as unknown as Database;
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

const elevate = (name: string, daysAgo: number) =>
  client`insert into access_control.break_glass_elevation (id, user_id, organization_id, scope_key, permission, reason, activated_at, expires_at) values (${id(name)}, ${id("holder")}, ${id("org")}, ${id("org")}, 'domain:administer', 'Fixture', now() - ${daysAgo} * interval '1 day', now() - ${daysAgo} * interval '1 day' + interval '15 minutes')`;
const review = (name: string, by: string | null) =>
  client`insert into access_control.access_review (id, kind, subject_id, snapshot, decision, note, reviewed_at, reviewed_by) values (${id(`r-${name}`)}, 'emergency', ${id(name)}, 'x', 'confirmed', 'Fixture note', now(), ${by})`;

test("old emergencies stay listed until a valid review settles them", async () => {
  await elevate("recent", 1);
  await elevate("settled", 120);
  await elevate("unreviewed", 120);
  await elevate("orphaned", 120);
  await elevate("self", 120);
  await client`insert into auth."user" (id, name, email, created_at, updated_at) values (${id("gone")}, 'Gone', ${`gone-${run}@tagaroa.test`}, now(), now())`;
  await review("settled", id("reviewer"));
  await review("self", id("holder"));
  await review("orphaned", id("gone"));
  await client`delete from auth."user" where id = ${id("gone")}`;

  const listed = (await service.list())
    .map((row) => row.id)
    .filter((subject) => subject.endsWith(run));
  expect(listed.sort()).toEqual(
    ["orphaned", "recent", "self", "unreviewed"].map(id).sort(),
  );
  expect(
    (
      await client`select reviewed_by from access_control.access_review where id = ${id("r-orphaned")}`
    )[0].reviewed_by,
  ).toBeNull();
});
