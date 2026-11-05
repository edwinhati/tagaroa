import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";

import type { INestApplication } from "@nestjs/common";

import { rolesOf } from "../../src/modules/auth/access-policy";
import {
  IdentityOperationsService,
  SUPER_ADMIN_ROLE_PATTERN,
} from "../../src/modules/auth/identity-operations.service";
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
    select id, role from auth."user" where role like '%super-admin%'`;
  for (const { id } of others)
    await sql`update auth."user" set role = 'user' where id = ${id}`;
  for (const id of ids)
    await sql`insert into auth."user" (id, name, email, role, banned, created_at, updated_at)
      values (${id}, ${id}, ${id + "@tagaroa.example"}, 'super-admin', null, now(), now())`;
});

afterAll(async () => {
  for (const { id, role } of others)
    await sql`update auth."user" set role = ${role} where id = ${id}`;
  await sql`delete from auth."user" where id in ${sql(ids)}`;
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
    await sql`select id from auth."user" where id in ${sql(ids)} and role = 'super-admin' and banned is not true`;
  expect(active).toHaveLength(1);
});

test("the SQL role match agrees with rolesOf for every character that can pad a token", async () => {
  // Every BMP code unit except NUL and the surrogates PostgreSQL cannot chr().
  const padded = await sql`
    select n from generate_series(1, 65535) n
    where n not between 55296 and 57343
      and (chr(n) || 'super-admin' || chr(n)) ~ ${SUPER_ADMIN_ROLE_PATTERN}`;
  const expected: number[] = [];
  for (let n = 1; n <= 65535; n++) {
    if (n >= 0xd800 && n <= 0xdfff) continue;
    const c = String.fromCharCode(n);
    if (rolesOf(`${c}super-admin${c}`).includes("super-admin"))
      expected.push(n);
  }
  expect(padded.map((row: { n: number }) => row.n)).toEqual(expected);
  expect(expected).toContain(0xa0);
  expect(expected).toContain(0xfeff);

  for (const [role, matches] of [
    ["super-admin", true],
    [" super-admin ", true],
    ["\tadmin,\u00a0super-admin\ufeff,helpdesk", true],
    ["admin, super-admin", true],
    ["not-super-admin", false],
    ["super-admin2", false],
    ["super-administrator", false],
    ["x-super-admin,admin", false],
    ["admin", false],
    ["", false],
  ] as const) {
    const [row] = await sql`select ${role} ~ ${SUPER_ADMIN_ROLE_PATTERN} as ok`;
    expect([role, row.ok]).toEqual([role, matches]);
    expect(rolesOf(role).includes("super-admin")).toBe(matches);
  }
});
