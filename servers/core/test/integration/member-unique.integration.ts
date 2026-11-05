import { expect, test } from "bun:test";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

import { prepareTestDatabase } from "../database";

const drizzleFolder = resolve(import.meta.dir, "../../drizzle");
const MIGRATION = "0004_member_unique_membership";

/** The migrations folder as it stood before this one, for a database that applied 0003. */
const folderBefore = () => {
  const folder = mkdtempSync(join(tmpdir(), "member-unique-"));
  cpSync(drizzleFolder, folder, { recursive: true });
  const journalPath = join(folder, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  journal.entries = journal.entries.filter(
    (entry: { tag: string }) => entry.tag !== MIGRATION,
  );
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
};

test.skipIf(Boolean(process.env.TEST_DATABASE_URL))(
  "the member migration removes duplicates without revoking access, then enforces one row per pair",
  async () => {
    await prepareTestDatabase();
    const name = `member_unique_${crypto.randomUUID().replaceAll("-", "")}`;
    const admin = new SQL(
      "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    );
    let client: SQL | undefined;
    const before = folderBefore();
    try {
      await admin.unsafe(`CREATE DATABASE ${name} OWNER tagaroa`);
      client = new SQL(`postgresql://tagaroa:tagaroa@127.0.0.1:5432/${name}`);
      // A database that has applied everything up to 0003 and holds a duplicate pair.
      const db = drizzle({ client });
      await migrate(db, { migrationsFolder: before });
      const [indexed] =
        await client`select 1 from pg_indexes where indexname = 'member_organizationId_userId_uidx'`;
      expect(indexed).toBeUndefined();
      await client`insert into auth."user" (id, name, email, created_at, updated_at) values ('person', 'Person', 'p@tagaroa.test', now(), now()), ('other', 'Other', 'o@tagaroa.test', now(), now())`;
      await client`insert into auth.organization (id, name, slug, created_at) values ('subsidiary', 'Sub', 'sub', now())`;
      await client`insert into auth.member (id, user_id, organization_id, role, created_at) values ('first', 'person', 'subsidiary', 'member', now() - interval '1 hour'), ('second', 'person', 'subsidiary', 'member', now()), ('single', 'other', 'subsidiary', 'member', now())`;
      await client`insert into access_control.access_assignment (id, user_id, role_id, organization_id, scope_key) values ('assignment', 'person', 'system-domain-administrator', 'subsidiary', 'subsidiary')`;

      // The real migrator must pick 0004 up on top of 0003 (its `when` is later).
      await migrate(db, { migrationsFolder: drizzleFolder });

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
      rmSync(before, { force: true, recursive: true });
      await client?.close();
      await admin.unsafe(`DROP DATABASE IF EXISTS ${name}`);
      await admin.close();
    }
  },
  60_000,
);
