import { resolve } from "node:path";

import { isSuperAdmin, mayRun } from "@repo/contracts/identity";
import { SQL } from "bun";
import { readMigrationFiles } from "drizzle-orm/migrator";

import { validateEnv, type AppEnv } from "../src/platform/config/env";

export interface PreflightCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export async function securityPreflight(
  client: SQL,
  env: AppEnv,
): Promise<PreflightCheck[]> {
  const checks: PreflightCheck[] = [
    {
      name: "production-configuration",
      passed: env.NODE_ENV === "production",
      detail: "Validate the target configuration with NODE_ENV=production.",
    },
    {
      name: "recovery-email-configuration",
      passed: Boolean(
        env.RESEND_API_KEY && env.RESEND_FROM && env.NOTIFICATION_WORKER,
      ),
      detail:
        "Email credentials and a running notification worker are required; delivery still needs a live exercise.",
    },
  ];

  return client.begin(async (tx) => {
    await tx`SET TRANSACTION READ ONLY`;
    const [schema] = await tx`select
      to_regclass('drizzle.__drizzle_migrations') is not null as migrations,
      to_regclass('auth.user') is not null and to_regclass('auth.two_factor') is not null
        and to_regclass('auth.account') is not null as identity`;
    if (schema.migrations) {
      const required = readMigrationFiles({
        migrationsFolder: resolve(import.meta.dir, "../drizzle"),
      });
      const applied: { hash: string }[] =
        await tx`select hash from drizzle.__drizzle_migrations`;
      const hashes = new Set(applied.map((row) => row.hash));
      checks.push({
        name: "migration-history",
        passed:
          required.length === applied.length &&
          required.every((migration) => hashes.has(migration.hash)),
        detail:
          "Applied migration hashes must match this release, including recovery and access-control migrations.",
      });
    } else {
      checks.push({
        name: "migration-history",
        passed: false,
        detail:
          "Migration history is missing. Do not start this release before migrating.",
      });
    }
    const triggers: { name: string }[] =
      await tx`select c.relname || '.' || t.tgname as name
      from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_proc p on p.oid = t.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
      where n.nspname = 'auth' and pn.nspname = 'access_control'
        and t.tgenabled in ('O', 'A') and not t.tgisinternal`;
    const enabled = new Set(triggers.map((row) => row.name));
    checks.push({
      name: "membership-and-suspension-revocation",
      passed: [
        "team_member.revoke_departed_team_access",
        "member.revoke_departed_subsidiary_access",
        "user.revoke_suspended_business_access",
      ].every((name) => enabled.has(name)),
      detail:
        "Team, subsidiary and suspension revocation triggers must be enabled for normal writes.",
    });

    if (schema.identity) {
      const operators: { id: string; role: string | null }[] =
        await tx`select u.id, u.role from auth."user" u
        where coalesce(u.banned, false) = false and coalesce(u.must_change_password, false) = false
          and u.two_factor_enabled = true
          and exists (select 1 from auth.two_factor f where f.user_id = u.id and f.verified = true)
          and exists (select 1 from auth.account a where a.user_id = u.id and a.provider_id = 'credential' and a.password is not null)`;
      const superAdmins = operators.filter((operator) =>
        isSuperAdmin(operator.role),
      );
      checks.push({
        name: "independent-recovery-operators",
        passed:
          superAdmins.length >= 2 &&
          operators.some(
            (operator) =>
              mayRun(operator.role, "support") &&
              superAdmins.filter((other) => other.id !== operator.id).length >=
                2,
          ),
        detail:
          "Require two active MFA-enrolled super-admins and a separate MFA-enrolled recovery requester, all past temporary-password setup.",
      });
    } else {
      checks.push({
        name: "independent-recovery-operators",
        passed: false,
        detail: "Identity tables are missing.",
      });
    }
    return checks;
  });
}

if (import.meta.main) {
  let client: SQL | undefined;
  try {
    const env = validateEnv(process.env);
    if (env.NODE_ENV !== "production")
      throw new Error(
        "Run preflight with the target production configuration.",
      );
    client = new SQL(env.DATABASE_URL);
    const checks = await securityPreflight(client, env);
    for (const check of checks)
      console.log(
        `${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`,
      );
    console.log(
      "MANUAL: verify named operator ownership, real email delivery, backup restore and HTTPS browser recovery before production acceptance.",
    );
    process.exitCode = checks.every((check) => check.passed) ? 0 : 1;
  } catch {
    // Driver/config errors can include credentials or connection strings.
    console.error(
      "Preflight failed. Check the target configuration, database connectivity and read permissions. No deployment was performed.",
    );
    process.exitCode = 1;
  } finally {
    await client?.close();
  }
}
