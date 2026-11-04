import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

import { prepareTestDatabase } from "../database";

const migration = readFileSync(
  resolve(import.meta.dir, "../../drizzle/0004_member_unique_membership.sql"),
  "utf8",
);

test.skipIf(Boolean(process.env.TEST_DATABASE_URL))(
  "the member migration removes duplicates without revoking access, then enforces one row per pair",
  async () => {
    await prepareTestDatabase();
    const name = `member_unique_${crypto.randomUUID().replaceAll("-", "")}`;
    const admin = new SQL(
      "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    );
    let client: SQL | undefined;
    try {
      await admin.unsafe(`CREATE DATABASE ${name} OWNER tagaroa`);
      client = new SQL(`postgresql://tagaroa:tagaroa@127.0.0.1:5432/${name}`);
      await migrate(drizzle({ client }), {
        migrationsFolder: resolve(import.meta.dir, "../../drizzle"),
      });
      // Back to the state before the migration: no index, a duplicate pair.
      await client`drop index auth."member_organizationId_userId_uidx"`;
      await client`insert into auth."user" (id, name, email, created_at, updated_at) values ('person', 'Person', 'p@tagaroa.test', now(), now()), ('other', 'Other', 'o@tagaroa.test', now(), now())`;
      await client`insert into auth.organization (id, name, slug, created_at) values ('subsidiary', 'Sub', 'sub', now())`;
      await client`insert into auth.member (id, user_id, organization_id, role, created_at) values ('first', 'person', 'subsidiary', 'member', now() - interval '1 hour'), ('second', 'person', 'subsidiary', 'member', now()), ('single', 'other', 'subsidiary', 'member', now())`;
      await client`insert into access_control.access_assignment (id, user_id, role_id, organization_id, scope_key) values ('assignment', 'person', 'system-domain-administrator', 'subsidiary', 'subsidiary')`;

      for (const statement of migration.split("--> statement-breakpoint"))
        await client.unsafe(statement);

      const rows = await client`select id from auth.member order by id`;
      expect(rows.map((r: { id: string }) => r.id)).toEqual([
        "first",
        "single",
      ]);
      const [assignment] =
        await client`select revoked_at from access_control.access_assignment where id = 'assignment'`;
      expect(assignment.revoked_at).toBeNull();
      // Bun 1.4.2's rejection matcher hangs on a lazy SQL query.
      await expect(
        Promise.resolve(
          client`insert into auth.member (id, user_id, organization_id, role, created_at) values ('third', 'person', 'subsidiary', 'member', now())`,
        ),
      ).rejects.toThrow();
      // The delete trigger is back on: removing the member revokes access.
      await client`delete from auth.member where id = 'first'`;
      const [revoked] =
        await client`select revoked_at from access_control.access_assignment where id = 'assignment'`;
      expect(revoked.revoked_at).not.toBeNull();
    } finally {
      await client?.close();
      await admin.unsafe(`DROP DATABASE IF EXISTS ${name}`);
      await admin.close();
    }
  },
  60_000,
);
