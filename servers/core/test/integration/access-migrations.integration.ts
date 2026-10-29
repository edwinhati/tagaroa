import { expect, test } from "bun:test";
import { resolve } from "node:path";

import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

import { securityPreflight } from "../../scripts/security-preflight";
import { validateEnv } from "../../src/platform/config/env";
import { prepareTestDatabase } from "../database";

test.skipIf(Boolean(process.env.TEST_DATABASE_URL))(
  "a fresh migration and backup restore preserve admission, evidence and revocation controls",
  async () => {
    await prepareTestDatabase();
    const databaseName = `access_migration_${crypto.randomUUID().replaceAll("-", "")}`;
    const restoredName = `${databaseName}_restored`;
    const admin = new SQL(
      "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    );
    const folder = resolve(import.meta.dir, "../../drizzle");
    let client: SQL | undefined;
    let restored: SQL | undefined;
    try {
      await admin.unsafe(`CREATE DATABASE ${databaseName} OWNER tagaroa`);
      client = new SQL(
        `postgresql://tagaroa:tagaroa@127.0.0.1:5432/${databaseName}`,
      );
      const production = validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: `postgresql://tagaroa:tagaroa@127.0.0.1:5432/${databaseName}`,
        BETTER_AUTH_SECRET: "fixture-production-secret-at-least-32-characters",
        BETTER_AUTH_URL: "https://core.company.example",
        TRUSTED_ORIGINS: "https://work.company.example",
        PASSKEY_ORIGINS: "https://work.company.example",
        PASSKEY_RP_ID: "company.example",
        RESEND_API_KEY: "fixture-never-sent",
        RESEND_FROM: "fixture@company.example",
      });
      const beforeMigration = await securityPreflight(client, production);
      expect(
        beforeMigration.find((check) => check.name === "migration-history")
          ?.passed,
      ).toBe(false);
      expect(
        beforeMigration.find(
          (check) => check.name === "membership-and-suspension-revocation",
        )?.passed,
      ).toBe(false);
      await migrate(drizzle({ client }), { migrationsFolder: folder });
      await client`insert into auth."user" (id, name, email, created_at, updated_at) values ('person', 'Migration fixture', 'migration@tagaroa.test', now(), now())`;
      await client`insert into auth.organization (id, name, slug, created_at) values ('subsidiary', 'Migration fixture', 'migration', now())`;
      await client`insert into auth.team (id, organization_id, name, created_at) values ('engineering', 'subsidiary', 'Engineering', now())`;
      await client`insert into access_control.team_domain (team_id, domain_slug) values ('engineering', 'engineering')`;
      await client`insert into auth.member (id, user_id, organization_id, role, created_at) values ('member', 'person', 'subsidiary', 'member', now())`;
      await client`insert into auth.team_member (id, user_id, team_id) values ('membership', 'person', 'engineering')`;
      await client`insert into auth.session (id, user_id, token, created_at, updated_at, expires_at) values ('session', 'person', 'fixture-token', now(), now(), now() + interval '1 hour')`;
      await client`insert into access_control.access_assignment (id, user_id, role_id, organization_id, team_id, scope_key) values ('assignment', 'person', 'system-domain-administrator', 'subsidiary', 'engineering', 'engineering')`;
      await client`insert into access_control.break_glass_elevation (id, user_id, session_id, organization_id, team_id, scope_key, permission, reason, expires_at) values ('emergency', 'person', 'session', 'subsidiary', 'engineering', 'engineering', 'domain:administer', 'Fixture emergency', now() + interval '15 minutes')`;
      expect(
        (
          await client`select revoked_at from access_control.access_assignment where id = 'assignment'`
        )[0].revoked_at,
      ).toBeNull();
      await client`delete from auth.session where id = 'session'`;
      expect(
        (
          await client`select session_id from access_control.break_glass_elevation where id = 'emergency'`
        )[0].session_id,
      ).toBeNull();
      await client`delete from auth.team_member where id = 'membership'`;
      await client`insert into auth.team_member (id, user_id, team_id) values ('replacement', 'person', 'engineering')`;
      expect(
        (
          await client`select revoked_at from access_control.access_assignment where id = 'assignment'`
        )[0].revoked_at,
      ).not.toBeNull();
      expect(
        (
          await client`select ended_at from access_control.break_glass_elevation where id = 'emergency'`
        )[0].ended_at,
      ).not.toBeNull();
      await client`insert into access_control.access_review (id, kind, subject_id, snapshot, decision, note, reviewed_at) values ('first', 'emergency', 'emergency', 'snapshot', 'flagged', 'Investigate this activation', now()), ('second', 'emergency', 'emergency', 'snapshot', 'confirmed', 'Investigation closed', now())`;
      await client`update auth.team set name = 'Platform delivery' where id = 'engineering'`;
      await migrate(drizzle({ client }), { migrationsFolder: folder });
      expect(
        (
          await client`select domain_slug from access_control.team_domain where team_id = 'engineering'`
        )[0].domain_slug,
      ).toBe("engineering");
      expect(
        await client`select id from access_control.access_review where subject_id = 'emergency'`,
      ).toHaveLength(2);
      await client`insert into identity_operations.factor_recovery (id, user_id, requested_at, expires_at, reason, evidence, snapshot, completed_at) values ('recovery', 'person', now(), now(), 'Fixture recovery', 'Fixture case evidence', 'fixture-snapshot', now())`;
      await client`insert into access_control.access_assignment (id, user_id, role_id, organization_id, team_id, scope_key) values ('restored-grant', 'person', 'system-domain-administrator', 'subsidiary', 'engineering', 'engineering')`;
      const compose = [
        "docker",
        "compose",
        "-f",
        resolve(import.meta.dir, "../../../../infra/docker/docker-compose.yml"),
        "exec",
        "-T",
        "postgres",
      ];
      const backup = Bun.spawnSync([
        ...compose,
        "pg_dump",
        "-U",
        "postgres",
        "--format=custom",
        databaseName,
      ]);
      if (!backup.success)
        throw new Error(`Fixture backup failed: ${backup.stderr.toString()}`);
      await admin.unsafe(`CREATE DATABASE ${restoredName} OWNER tagaroa`);
      const restore = Bun.spawnSync(
        [
          ...compose,
          "pg_restore",
          "-U",
          "postgres",
          "--role=tagaroa",
          "--no-owner",
          "--no-acl",
          "--exit-on-error",
          "--dbname",
          restoredName,
        ],
        { stdin: backup.stdout },
      );
      if (!restore.success)
        throw new Error(`Fixture restore failed: ${restore.stderr.toString()}`);
      restored = new SQL(
        `postgresql://tagaroa:tagaroa@127.0.0.1:5432/${restoredName}`,
      );
      await migrate(drizzle({ client: restored }), {
        migrationsFolder: folder,
      });
      const restoredChecks = await securityPreflight(restored, production);
      expect(
        restoredChecks
          .filter((check) => !check.passed)
          .map((check) => check.name),
      ).toEqual(["independent-recovery-operators"]);
      for (const [id, role] of [
        ["super-one", "super-admin"],
        ["super-two", "super-admin"],
        ["requester", "helpdesk"],
      ]) {
        await restored`insert into auth."user" (id, name, email, created_at, updated_at, role, two_factor_enabled) values (${id!}, 'Preflight fixture', ${`${id}@preflight.example`}, now(), now(), ${role!}, true)`;
        await restored`insert into auth.account (id, account_id, provider_id, user_id, password, created_at, updated_at) values (${id!}, ${id!}, 'credential', ${id!}, 'fixture-credential', now(), now())`;
        await restored`insert into auth.two_factor (id, user_id, secret, backup_codes, verified) values (${id!}, ${id!}, 'fixture-secret', 'fixture-backup', ${id !== "requester"})`;
      }
      expect(
        (await securityPreflight(restored, production)).every(
          (check) => check.passed,
        ),
      ).toBe(false);
      await restored`update auth.two_factor set verified = true where user_id = 'requester'`;
      expect(
        (await securityPreflight(restored, production)).every(
          (check) => check.passed,
        ),
      ).toBe(true);
      expect(
        (
          await securityPreflight(restored, {
            ...production,
            RESEND_API_KEY: undefined,
          })
        ).find((check) => check.name === "recovery-email-configuration")
          ?.passed,
      ).toBe(false);
      await restored`update auth."user" set must_change_password = true where id = 'requester'`;
      expect(
        (await securityPreflight(restored, production)).find(
          (check) => check.name === "independent-recovery-operators",
        )?.passed,
      ).toBe(false);
      await restored`update auth."user" set must_change_password = false, banned = true where id = 'requester'`;
      expect(
        (await securityPreflight(restored, production)).find(
          (check) => check.name === "independent-recovery-operators",
        )?.passed,
      ).toBe(false);
      await restored`update auth."user" set banned = false where id = 'requester'`;
      const command = Bun.spawnSync(["bun", "run", "security:preflight"], {
        cwd: resolve(import.meta.dir, "../.."),
        env: {
          ...process.env,
          NODE_ENV: "production",
          DATABASE_URL: `postgresql://tagaroa:tagaroa@127.0.0.1:5432/${restoredName}`,
          BETTER_AUTH_SECRET: production.BETTER_AUTH_SECRET,
          BETTER_AUTH_URL: production.BETTER_AUTH_URL,
          TRUSTED_ORIGINS: production.TRUSTED_ORIGINS.join(","),
          PASSKEY_ORIGINS: production.PASSKEY_ORIGINS.join(","),
          PASSKEY_RP_ID: production.PASSKEY_RP_ID,
          RESEND_API_KEY: production.RESEND_API_KEY,
          RESEND_FROM: production.RESEND_FROM,
          NOTIFICATION_WORKER: "1",
        },
      });
      expect(command.success).toBe(true);
      expect(command.stdout.toString()).toContain(
        "PASS independent-recovery-operators",
      );
      expect(command.stdout.toString()).toContain("MANUAL:");
      expect(
        command.stdout.toString() + command.stderr.toString(),
      ).not.toContain(production.BETTER_AUTH_SECRET);
      await restored`alter table auth.team_member disable trigger revoke_departed_team_access`;
      expect(
        (await securityPreflight(restored, production)).find(
          (check) => check.name === "membership-and-suspension-revocation",
        )?.passed,
      ).toBe(false);
      await restored`alter table auth.team_member enable trigger revoke_departed_team_access`;
      expect(
        (
          await restored`select domain_slug from access_control.team_domain where team_id = 'engineering'`
        )[0].domain_slug,
      ).toBe("engineering");
      expect(
        await restored`select id from access_control.access_review where subject_id = 'emergency'`,
      ).toHaveLength(2);
      expect(
        (
          await restored`select completed_at from identity_operations.factor_recovery where id = 'recovery'`
        )[0].completed_at,
      ).not.toBeNull();
      expect(
        (
          await restored`select revoked_at from access_control.access_assignment where id = 'assignment'`
        )[0].revoked_at,
      ).not.toBeNull();
      expect(
        (
          await restored`select ended_at from access_control.break_glass_elevation where id = 'emergency'`
        )[0].ended_at,
      ).not.toBeNull();
      await restored`delete from auth.team_member where id = 'replacement'`;
      expect(
        (
          await restored`select revoked_at from access_control.access_assignment where id = 'restored-grant'`
        )[0].revoked_at,
      ).not.toBeNull();
    } finally {
      await restored?.close();
      await client?.close();
      await admin.unsafe(`DROP DATABASE IF EXISTS ${restoredName}`);
      await admin.unsafe(`DROP DATABASE IF EXISTS ${databaseName}`);
      await admin.close();
    }
  },
  60_000,
);
