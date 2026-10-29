import { beforeAll, expect, setDefaultTimeout, test } from "bun:test";

import { SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";

import { notificationMessage } from "../../src/modules/notification/infrastructure/persistence/drizzle/schema";
import { prepareTestDatabase, testEnv } from "../database";

Object.assign(process.env, testEnv);
setDefaultTimeout(60_000);

let client: SQL;
let db: ReturnType<typeof drizzle<{ notificationMessage: never }>>;

beforeAll(async () => {
  await prepareTestDatabase();
  client = new SQL(testEnv.DATABASE_URL);
  db = drizzle({ client }) as typeof db;
});

/**
 * What the delivery log reads, and what the entities read, are two different
 * paths through the same column.
 *
 * Drizzle's own `jsonb` stringifies on the way to the driver and Bun's `SQL`
 * serialises again, so the column held a JSON *string* whose contents were
 * JSON. Reads through the mapper parsed that back and looked correct, which is
 * exactly why it went unnoticed: every entity assertion in this suite passed
 * while `payload->>'body'` — the expression the admin log selects — returned
 * null, and "What was sent" was blank for messages that had sent perfectly.
 *
 * So this asserts the SQL view, not the mapped one. A round trip that only
 * checked `row.payload.body` would still pass with the bug in place.
 */
test("a jsonb column stores JSON, not a string containing JSON", async () => {
  const id = `jsonb-round-trip-${crypto.randomUUID()}`;

  await db.insert(notificationMessage).values({
    channel: "email",
    destination: "round-trip@tagaroa.test",
    id,
    key: "probe",
    locale: "en",
    payload: {
      body: "First line\n\nSecond line",
      subject: "Probe",
      variables: [],
    },
    secrets: { password: "held" },
  });

  const [stored] = await client`
    select jsonb_typeof(payload) as payload_type,
           jsonb_typeof(secrets) as secrets_type,
           payload->>'subject' as subject,
           payload->>'body' as body
    from notification.message where id = ${id}`;

  expect(stored.payload_type).toBe("object");
  expect(stored.secrets_type).toBe("object");
  expect(stored.subject).toBe("Probe");
  expect(stored.body).toBe("First line\n\nSecond line");

  // And the mapped read still returns the object, so fixing the write did not
  // move the problem to the path that was already working.
  const [mapped] = await db
    .select()
    .from(notificationMessage)
    .where(eq(notificationMessage.id, id));
  expect(mapped?.payload.subject).toBe("Probe");
  expect(mapped?.secrets).toEqual({ password: "held" });

  await db.delete(notificationMessage).where(eq(notificationMessage.id, id));
});
