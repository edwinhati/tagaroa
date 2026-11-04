import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";

import type { INestApplication } from "@nestjs/common";

import { IdentityOperationsService } from "../../src/modules/auth/identity-operations.service";
import {
  DATABASE,
  type Database,
} from "../../src/platform/database/database.module";
import { prepareTestDatabase, testEnv } from "../database";

setDefaultTimeout(60_000);

let app: INestApplication;
let sql: Database["$client"];
let others: { id: string; role: string }[];
const ids = [0, 1].map((n) => `last-sa-${n}-${crypto.randomUUID()}`);

beforeAll(async () => {
  await prepareTestDatabase();
  Object.assign(process.env, testEnv);
  const { createApplication } = await import("../../src/application");
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  sql = app.get<Database>(DATABASE).$client;
  // The invariant is about every active super administrator, so park the
  // others (restored in afterAll). Files run one after another.
  others = await sql`
    update auth."user" set role = 'user'
    where role like '%super-admin%' returning id, role`;
  for (const id of ids)
    await sql`insert into auth."user" (id, name, email, role, banned, created_at, updated_at)
      values (${id}, ${id}, ${id + "@tagaroa.example"}, 'super-admin', null, now(), now())`;
});

afterAll(async () => {
  for (const { id, role } of others)
    await sql`update auth."user" set role = ${role} where id = ${id}`;
  await sql`delete from auth."user" where id = any(${ids})`;
  await app?.close();
});

test("two concurrent retirements of the last two super administrators leave one", async () => {
  const identity = app.get(IdentityOperationsService, { strict: false });
  const results = await Promise.allSettled(
    ids.map((id) => identity.retire(id, "Case OFF-84", null)),
  );
  expect(results.map((r) => r.status).sort()).toEqual([
    "fulfilled",
    "rejected",
  ]);
  const active =
    await sql`select id from auth."user" where id = any(${ids}) and role = 'super-admin' and banned is not true`;
  expect(active).toHaveLength(1);
});
