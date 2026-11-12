import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";

import {
  NOTIFICATION_CHANNELS,
  SUPPRESSION_REASONS,
} from "@repo/contracts/notifications";
import { SQL } from "bun";
import { like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";

import { notificationSuppression } from "../../src/modules/notification/infrastructure/persistence/drizzle/schema";
import { collectionOver } from "../../src/platform/database/collection";
import type { Database } from "../../src/platform/database/database.module";
import type { QueryRecord } from "../../src/platform/http/collection";
import { prepareTestDatabase, testEnv } from "../database";

Object.assign(process.env, testEnv);
setDefaultTimeout(60_000);

/**
 * The facet rule, against real SQL.
 *
 * It was written twice by hand — once in the message log, once in the
 * suppression list — and verified neither time, which is the whole reason
 * `collectionOver` exists. Postgres is the only thing that can actually say
 * whether the four `where` clauses it builds are the right four, so this runs
 * against the database rather than against a mock of it.
 */

/** Every fixture carries this, so the search scopes each assertion to them. */
const TOKEN = "collectionplanner";

const SUPPRESSIONS = collectionOver<{
  id: string;
  channel: string;
  destination: string;
  reason: string;
}>(notificationSuppression, {
  defaultSort: "-createdAt",
  filters: {
    channel: {
      column: notificationSuppression.channel,
      values: NOTIFICATION_CHANNELS,
    },
    reason: {
      column: notificationSuppression.reason,
      values: SUPPRESSION_REASONS,
    },
  },
  search: [notificationSuppression.destination],
  select: {
    channel: notificationSuppression.channel,
    destination: notificationSuppression.destination,
    id: notificationSuppression.id,
    reason: notificationSuppression.reason,
  },
  sort: {
    channel: notificationSuppression.channel,
    createdAt: notificationSuppression.createdAt,
    destination: notificationSuppression.destination,
  },
});

const FIXTURES = [
  { channel: "email", destination: `a.${TOKEN}`, reason: "bounced" },
  { channel: "email", destination: `b.${TOKEN}`, reason: "bounced" },
  { channel: "email", destination: `c.${TOKEN}`, reason: "complained" },
  { channel: "sms", destination: `d.${TOKEN}`, reason: "bounced" },
  { channel: "whatsapp", destination: `e.${TOKEN}`, reason: "failed" },
] as const;

let client: SQL;
let database: Database;

/** `q` scopes every query to this test's own rows. */
const page = (query: QueryRecord = {}) =>
  SUPPRESSIONS.page(database, { q: TOKEN, ...query }, { path: "/collections" });

/** Buckets come back in whatever order the group by produced. */
const buckets = (rows: { value: string; count: number }[] | undefined) =>
  Object.fromEntries(
    [...(rows ?? [])]
      .sort((first, second) => first.value.localeCompare(second.value))
      .map((row) => [row.value, row.count]),
  );

beforeAll(async () => {
  await prepareTestDatabase();
  client = new SQL(testEnv.DATABASE_URL);
  database = drizzle({ client }) as Database;

  await database
    .delete(notificationSuppression)
    .where(like(notificationSuppression.destination, `%${TOKEN}%`));
  await database.insert(notificationSuppression).values(
    FIXTURES.map((fixture, index) => ({
      ...fixture,
      // Ordered so that `-createdAt` has something to order by.
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
      id: `${TOKEN}-${index}`,
    })),
  );
});

afterAll(async () => {
  await database
    .delete(notificationSuppression)
    .where(like(notificationSuppression.destination, `%${TOKEN}%`));
  await client.close();
});

describe("the search", () => {
  test("narrows the rows, the total and every bucket", async () => {
    const collection = await page();

    expect(collection.data).toHaveLength(5);
    expect(collection.meta.total).toBe(5);
    expect(buckets(collection.meta.aggregations?.channel)).toEqual({
      email: 3,
      sms: 1,
      whatsapp: 1,
    });
    expect(buckets(collection.meta.aggregations?.reason)).toEqual({
      bounced: 3,
      complained: 1,
      failed: 1,
    });
  });
});

describe("a facet's own selection", () => {
  test("narrows the rows", async () => {
    const collection = await page({ channel: "email" });

    expect(collection.meta.total).toBe(3);
    expect(collection.data.every((row) => row.channel === "email")).toBe(true);
  });

  test("is left out of its own counts", async () => {
    const collection = await page({ channel: "email" });

    // Not `{ email: 3 }`: the counts exist to say what the channels you have
    // not chosen would give, which is the whole point of showing them.
    expect(buckets(collection.meta.aggregations?.channel)).toEqual({
      email: 3,
      sms: 1,
      whatsapp: 1,
    });
  });

  test("is applied to every other facet's counts", async () => {
    const collection = await page({ channel: "email" });

    expect(buckets(collection.meta.aggregations?.reason)).toEqual({
      bounced: 2,
      complained: 1,
    });
  });
});

describe("two selected facets", () => {
  test("narrow the rows together", async () => {
    const collection = await page({ channel: "email", reason: "bounced" });

    expect(collection.meta.total).toBe(2);
  });

  test("each still count against the other alone", async () => {
    const collection = await page({ channel: "email", reason: "bounced" });

    // Channels, as narrowed by `reason=bounced` but not by `channel=email`.
    expect(buckets(collection.meta.aggregations?.channel)).toEqual({
      email: 2,
      sms: 1,
    });
    // Reasons, as narrowed by `channel=email` but not by `reason=bounced`.
    expect(buckets(collection.meta.aggregations?.reason)).toEqual({
      bounced: 2,
      complained: 1,
    });
  });

  test("several values of one facet are a union, not an intersection", async () => {
    const collection = await page({ reason: ["bounced", "failed"] });

    expect(collection.meta.total).toBe(4);
  });
});

describe("paging and ordering", () => {
  test("orders by the default when the request names none", async () => {
    const collection = await page();

    // `-createdAt`: the newest fixture first.
    expect(collection.data[0]!.destination).toBe(`e.${TOKEN}`);
  });

  test("a request's own sort wins over the default", async () => {
    const collection = await page({ sort: "destination" });

    expect(collection.data.map((row) => row.destination)).toEqual(
      FIXTURES.map((fixture) => fixture.destination),
    );
  });

  test("pages without losing the total or the buckets", async () => {
    const collection = await page({
      limit: "2",
      page: "2",
      sort: "destination",
    });

    expect(collection.data.map((row) => row.destination)).toEqual([
      `c.${TOKEN}`,
      `d.${TOKEN}`,
    ]);
    expect(collection.meta).toMatchObject({
      hasNext: true,
      hasPrevious: true,
      total: 5,
      totalPages: 3,
    });
    expect(buckets(collection.meta.aggregations?.channel)).toEqual({
      email: 3,
      sms: 1,
      whatsapp: 1,
    });
  });
});

describe("refusals", () => {
  test("a filter value outside the declared set is a bad request", async () => {
    expect(page({ reason: "annoyed" })).rejects.toThrow(
      "annoyed is not a valid reason filter.",
    );
  });

  test("a sort field that was not declared is a bad request", async () => {
    expect(page({ sort: "reason" })).rejects.toThrow("Cannot sort by reason.");
  });
});
