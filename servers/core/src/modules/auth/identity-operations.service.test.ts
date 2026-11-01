import { describe, expect, test } from "bun:test";

import { verifyPassword } from "better-auth/crypto";
import { eq, type SQL } from "drizzle-orm";
import { PgDialect, type PgTable } from "drizzle-orm/pg-core";

import type { Database } from "../../platform/database/database.module";
import type { AuditTrail } from "../audit/application/audit.facade";
import { requestRecoveryBody } from "./auth-management.schemas";
import {
  IdentityOperationsService,
  requireVerifiedOperator,
  type IdentityOperator,
} from "./identity-operations.service";
import {
  account,
  member,
  passkey,
  session,
  teamMember,
  twoFactor,
  user,
  verification,
} from "./infrastructure/persistence/drizzle/schema";
import { OnboardingHook } from "./onboarding.hook";
import { factorRecovery } from "./operations.schema";

const actor = (
  overrides: Partial<IdentityOperator> = {},
): IdentityOperator => ({
  id: "requester",
  role: "super-admin",
  twoFactorEnabled: true,
  sessionCreatedAt: new Date(),
  ...overrides,
});
const request = requestRecoveryBody.parse({
  identityVerified: true,
  reason: "Lost factors; case REC-123",
  evidence: "Manager callback; case REC-123",
});
const approval = {
  identityVerified: true as const,
  evidence: "Independent callback; case REC-123",
};
const person = {
  id: "person",
  role: "user",
  banned: false,
  twoFactorEnabled: true,
};
const credential = { id: "password", password: "old-hash" };
const factor = {
  id: "totp",
  secret: "old-secret",
  backupCodes: "old-codes",
  verified: true,
};
const key = {
  id: "passkey",
  credentialID: "credential",
  publicKey: "public-key",
};
const predicate = (where: SQL) => new PgDialect().sqlToQuery(where);
type Write = {
  kind: "insert" | "update" | "delete";
  table: PgTable;
  values?: Record<string, unknown>;
  where?: ReturnType<typeof predicate>;
};

// Queue reads, record writes, and reject any query outside the transaction.
// PostgreSQL's business-grant revocation triggers are covered by integration tests.
const fixture = () => {
  const reads = new Map<PgTable, unknown[][]>();
  const writes: Write[] = [];
  const locks: PgTable[] = [];
  const selections: { table: PgTable; where: ReturnType<typeof predicate> }[] =
    [];
  const events: Parameters<AuditTrail["record"]>[0][] = [];
  const deliveries: unknown[][] = [];
  let transactions = 0;
  let inTransaction = false;
  const queue = (table: PgTable, ...rows: unknown[][]) =>
    reads.set(table, rows);
  const tx = {
    select: () => ({
      from: (table: PgTable) => ({
        where: (where: SQL) => {
          selections.push({ table, where: predicate(where) });
          expect(inTransaction).toBe(true);
          const rows = reads.get(table)?.shift();
          if (!rows) throw new Error("Unexpected database read");
          return Object.assign(Promise.resolve(rows), {
            for: (mode: string) => {
              expect(mode).toBe("update");
              locks.push(table);
              return Promise.resolve(rows);
            },
          });
        },
      }),
    }),
    insert: (table: PgTable) => ({
      values: async (values: Record<string, unknown>) => {
        expect(inTransaction).toBe(true);
        writes.push({ kind: "insert", table, values });
      },
    }),
    update: (table: PgTable) => ({
      set: (values: Record<string, unknown>) => ({
        where: async (where: SQL) => {
          expect(inTransaction).toBe(true);
          writes.push({
            kind: "update",
            table,
            values,
            where: predicate(where),
          });
        },
      }),
    }),
    delete: (table: PgTable) => ({
      where: async (where: SQL) => {
        expect(inTransaction).toBe(true);
        writes.push({ kind: "delete", table, where: predicate(where) });
      },
    }),
  };
  const database = {
    transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => {
      transactions++;
      inTransaction = true;
      try {
        return await work(tx);
      } finally {
        inTransaction = false;
      }
    },
  } as unknown as Database;
  const audit: AuditTrail = {
    recent: async () => [],
    record: async (event) => {
      expect(inTransaction).toBe(false);
      events.push(event);
    },
  };
  const onboarding = new OnboardingHook(database, {
    send: async () => {
      throw new Error("Unexpected notification");
    },
  });
  onboarding.deliverRecoveryPassword = async (...args) => {
    expect(inTransaction).toBe(false);
    deliveries.push(args);
    return { queued: false, destination: null };
  };
  const service = new IdentityOperationsService(database, audit, onboarding);
  const recovery = async () => {
    queue(user, [person]);
    queue(account, [credential]);
    queue(twoFactor, [factor]);
    queue(passkey, [key]);
    queue(factorRecovery, []);
    const { id } = await service.requestRecovery(person.id, request, actor());
    const stored = {
      ...writes[0]!.values,
      id,
    } as typeof factorRecovery.$inferSelect;
    writes.length = 0;
    events.length = 0;
    locks.length = 0;
    selections.length = 0;
    queue(factorRecovery, [stored]);
    queue(user, [actor()], [person]);
    queue(account, [credential]);
    queue(twoFactor, [factor]);
    queue(passkey, [key]);
    return stored;
  };
  return {
    service,
    queue,
    writes,
    locks,
    selections,
    events,
    deliveries,
    recovery,
    transactions: () => transactions,
  };
};

describe("IdentityOperationsService.requestRecovery", () => {
  test("requires verification evidence at the request boundary", () => {
    for (const evidence of [undefined, "", "   ", "short", "x".repeat(501)]) {
      expect(
        requestRecoveryBody.safeParse({ ...request, evidence }).success,
      ).toBe(false);
    }
    expect(
      requestRecoveryBody.safeParse({ ...request, identityVerified: false })
        .success,
    ).toBe(false);
  });

  test("refuses self-request before accessing the database", async () => {
    const f = fixture();
    await expect(
      f.service.requestRecovery(person.id, request, actor({ id: person.id })),
    ).rejects.toThrow("Another operator");
    expect(f.transactions()).toBe(0);
    expect(f.events).toEqual([]);
  });

  test("refuses suspended accounts, missing credentials and accounts without recoverable factors", async () => {
    for (const [target, credentials, keys, message] of [
      [{ ...person, banned: true }, [credential], [key], "suspension process"],
      [person, [], [key], "ordinary password recovery"],
      [
        { ...person, twoFactorEnabled: false },
        [credential],
        [],
        "ordinary password recovery",
      ],
    ] as const) {
      const f = fixture();
      f.queue(user, [target]);
      f.queue(account, [...credentials]);
      f.queue(twoFactor, []);
      f.queue(passkey, [...keys]);
      await expect(
        f.service.requestRecovery(person.id, request, actor()),
      ).rejects.toThrow(message);
      expect(f.writes).toEqual([]);
      expect(f.events).toEqual([]);
    }
  });

  test("stores a one-hour request with evidence and an account snapshot", async () => {
    const f = fixture();
    const stored = await f.recovery();
    expect(stored).toMatchObject({
      userId: person.id,
      requestedBy: "requester",
      reason: request.reason,
      evidence: request.evidence,
    });
    expect(stored.snapshot).toMatch(/^[a-f0-9]{64}$/);
    expect(
      (stored.expiresAt as Date).getTime() -
        (stored.requestedAt as Date).getTime(),
    ).toBeGreaterThanOrEqual(3_600_000);
  });
});

describe("IdentityOperationsService.approveRecovery", () => {
  test("the requester and the account holder cannot approve", async () => {
    for (const id of ["requester", person.id]) {
      const f = fixture();
      const stored = await f.recovery();
      await expect(
        f.service.approveRecovery(stored.id, approval, actor({ id })),
      ).rejects.toThrow("different super administrator");
      expect(f.writes).toEqual([]);
      expect(f.events).toEqual([]);
      expect(f.deliveries).toEqual([]);
    }
  });

  test("rejects expired and already completed requests without issuing a password", async () => {
    for (const change of [
      { expiresAt: new Date(0) },
      { completedAt: new Date() },
    ]) {
      const f = fixture();
      const stored = await f.recovery();
      f.queue(factorRecovery, [{ ...stored, ...change }]);
      await expect(
        f.service.approveRecovery(
          stored.id,
          approval,
          actor({ id: "approver" }),
        ),
      ).rejects.toThrow("completed or expired");
      expect(f.writes).toEqual([]);
      expect(f.events).toEqual([]);
      expect(f.deliveries).toEqual([]);
    }
  });

  test("invalidates the request when identity, password, authenticator or passkey changed", async () => {
    for (const changed of [user, account, twoFactor, passkey]) {
      const f = fixture();
      const stored = await f.recovery();
      if (changed === user)
        f.queue(user, [actor()], [{ ...person, role: "admin" }]);
      if (changed === account)
        f.queue(account, [{ ...credential, password: "new-hash" }]);
      if (changed === twoFactor)
        f.queue(twoFactor, [{ ...factor, backupCodes: "new-codes" }]);
      if (changed === passkey)
        f.queue(passkey, [{ ...key, publicKey: "new-key" }]);
      await expect(
        f.service.approveRecovery(
          stored.id,
          approval,
          actor({ id: "approver" }),
        ),
      ).rejects.toThrow("Account security changed");
      expect(f.writes).toEqual([
        {
          kind: "update",
          table: factorRecovery,
          values: { expiresAt: new Date(0) },
          where: predicate(eq(factorRecovery.id, stored.id)),
        },
      ]);
      expect(f.events).toEqual([]);
      expect(f.deliveries).toEqual([]);
    }
  });

  test("rotates the credential and revokes factors, passkeys, sessions and pending verifications atomically", async () => {
    const f = fixture();
    const stored = await f.recovery();
    const before = Date.now();
    const result = await f.service.approveRecovery(
      stored.id,
      approval,
      actor({ id: "approver" }),
    );
    expect(f.transactions()).toBe(2);
    expect(f.locks).toEqual([factorRecovery, user]);
    expect(f.selections.slice(0, 3)).toEqual([
      {
        table: factorRecovery,
        where: predicate(eq(factorRecovery.id, stored.id)),
      },
      { table: user, where: predicate(eq(user.id, "requester")) },
      { table: user, where: predicate(eq(user.id, person.id)) },
    ]);
    const passwordWrite = f.writes[0]!;
    expect(passwordWrite.table).toBe(account);
    expect(passwordWrite.where?.params).toEqual([person.id, "credential"]);
    expect(
      await verifyPassword({
        hash: passwordWrite.values!.password as string,
        password: result.temporaryPassword,
      }),
    ).toBe(true);
    expect(f.writes.filter((write) => write.kind === "delete")).toEqual(
      (
        [
          [twoFactor, twoFactor.userId],
          [passkey, passkey.userId],
          [session, session.userId],
          [verification, verification.value],
        ] as const
      ).map(([table, column]): Write => ({
        kind: "delete",
        table,
        where: predicate(eq(column, person.id)),
      })),
    );
    expect(f.writes[5]).toMatchObject({
      kind: "update",
      values: { twoFactorEnabled: false, mustChangePassword: true },
    });
    expect(f.writes).toHaveLength(7);
    expect(f.writes[5]!.table).toBe(user);
    expect(f.writes[5]!.where).toEqual(predicate(eq(user.id, person.id)));
    const expiry = f.writes[5]!.values!.temporaryPasswordExpiresAt as Date;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + 24 * 60 * 60_000);
    expect(expiry.getTime()).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60_000);
    expect(f.writes[6]).toMatchObject({
      values: {
        approvedBy: "approver",
        approvalEvidence: approval.evidence,
        completedAt: expect.any(Date),
      },
    });
    expect(f.writes[6]!.table).toBe(factorRecovery);
    expect(f.writes[6]!.where).toEqual(
      predicate(eq(factorRecovery.id, stored.id)),
    );
    expect(f.deliveries).toEqual([
      [person, result.temporaryPassword, stored.id],
    ]);
    expect(f.events).toEqual([
      {
        actorId: "approver",
        targetUserId: person.id,
        type: "user.factor-recovery.completed",
        detail: `${stored.id}: ${approval.evidence}`,
      },
    ]);
    expect(JSON.stringify(f.events)).not.toContain(result.temporaryPassword);
  });
});

describe("IdentityOperationsService offboarding", () => {
  test("protects the last active super-admin through offboard and retire", async () => {
    for (const offboard of [true, false]) {
      const f = fixture();
      const target = { ...person, role: "super-admin" };
      f.queue(
        user,
        [target],
        [target, { id: "ordinary-admin", role: "admin" }],
      );
      await expect(
        offboard
          ? f.service.offboard(person.id, "Case OFF-123", actor())
          : f.service.retire(person.id, "Case OFF-123", null),
      ).rejects.toThrow("Keep another active administrator");
      expect(f.writes).toEqual([]);
      expect(f.events).toEqual([]);
    }
  });

  test("suspends and removes sessions and memberships in one transaction, retaining history", async () => {
    const f = fixture();
    f.queue(
      user,
      [{ ...person, role: "super-admin" }],
      [{ ...person, role: "super-admin" }, actor()],
    );
    expect(
      await f.service.offboard(person.id, "Case OFF-123", actor()),
    ).toEqual({ offboarded: true });
    expect(f.transactions()).toBe(1);
    expect(f.locks).toEqual([user]);
    expect(f.writes).toEqual([
      {
        kind: "update",
        table: user,
        values: {
          banned: true,
          role: "user",
          banReason: "Case OFF-123",
          banExpires: null,
          updatedAt: expect.any(Date),
        },
        where: predicate(eq(user.id, person.id)),
      },
      ...(
        [
          [session, session.userId],
          [verification, verification.value],
          [teamMember, teamMember.userId],
          [member, member.userId],
        ] as const
      ).map(([table, column]): Write => ({
        kind: "delete",
        table,
        where: predicate(eq(column, person.id)),
      })),
    ]);
    expect(f.events).toEqual([
      {
        actorId: "requester",
        targetUserId: person.id,
        type: "user.offboarded",
        detail: "Case OFF-123",
      },
    ]);
  });

  test("retire can be repeated without restoring privileges or revoked grants", async () => {
    const f = fixture();
    f.queue(user, [person], [{ ...person, banned: true, role: "user" }]);
    await f.service.retire(person.id, "Case OFF-123", null);
    const first = [...f.writes];
    f.writes.length = 0;
    await f.service.retire(person.id, "Case OFF-123", null);
    expect(f.transactions()).toBe(2);
    expect(f.writes).toEqual(
      first.map((write) =>
        write.kind === "update"
          ? {
              ...write,
              values: { ...write.values, updatedAt: expect.any(Date) },
            }
          : write,
      ),
    );
    expect(f.events).toHaveLength(2);
    expect(f.events.every((event) => event.actorId === null)).toBe(true);
  });
});

test("security operations require a fresh, non-impersonated MFA operator", () => {
  const actor: IdentityOperator = {
    id: "operator",
    role: "super-admin",
    twoFactorEnabled: true,
    sessionCreatedAt: new Date(),
  };
  expect(() => requireVerifiedOperator(actor)).not.toThrow();
  for (const change of [
    { impersonatedBy: "other" },
    { twoFactorEnabled: false },
    { sessionCreatedAt: new Date("invalid") },
    { sessionCreatedAt: new Date(Date.now() + 60_000) },
    { sessionCreatedAt: new Date(Date.now() - 15 * 60_000) },
  ])
    expect(() => requireVerifiedOperator({ ...actor, ...change })).toThrow();
});
