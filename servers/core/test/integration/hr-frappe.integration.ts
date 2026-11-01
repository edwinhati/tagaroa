import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { eq } from "drizzle-orm";

import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../../src/modules/audit/application/audit.facade";
import {
  ACCOUNT_LIFECYCLE,
  type AccountLifecycle,
} from "../../src/modules/auth/account-lifecycle.facade";
import {
  session,
  user,
} from "../../src/modules/auth/infrastructure/persistence/drizzle/schema";
import { ReconcileEmployeesUseCase } from "../../src/modules/hr/application/use-cases/reconcile-employees.use-case";
import {
  HR_OPTIONS,
  type HrOptions,
} from "../../src/modules/hr/infrastructure/config/hr.options";
import { employeeAccount } from "../../src/modules/hr/infrastructure/persistence/drizzle/schema";
import { HrReconciler } from "../../src/modules/hr/infrastructure/scheduling/hr.reconciler";
import { notificationMessage } from "../../src/modules/notification/infrastructure/persistence/drizzle/schema";
import {
  DATABASE,
  type Database,
} from "../../src/platform/database/database.module";
import { prepareTestDatabase, testEnv } from "../database";
import { type FrappeEmployee, fakeFrappe } from "../fake-frappe";

setDefaultTimeout(60_000);

/**
 * ADR 0004 end to end: signed webhook → REST re-read → account, and the hourly
 * pass, against a fake Frappe. Every record is added after the startup pass
 * has finished against an empty roster, so no test races it (see ISSUE-32).
 */

const SECRET = "frappe-webhook-secret-at-least-32-chars";
const run = crypto.randomUUID().slice(0, 8);
const frappe = fakeFrappe({ key: "key", secret: "secret" });

let app: INestApplication;
let baseURL: string;
let db: Database;

beforeAll(async () => {
  await prepareTestDatabase();
  Object.assign(process.env, testEnv, {
    FRAPPE_API_KEY: "key",
    FRAPPE_API_SECRET: "secret",
    FRAPPE_URL: frappe.url,
    FRAPPE_WEBHOOK_SECRET: SECRET,
  });
  const { createApplication } = await import("../../src/application");
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  baseURL = await app.getUrl();
  db = app.get<Database>(DATABASE);
  const reconciler = app.get(HrReconciler) as unknown as { running: boolean };
  while (reconciler.running) await Bun.sleep(10);
});

afterAll(async () => {
  await app?.close();
  await frappe.stop();
});

const hire = (
  id: string,
  record: Partial<FrappeEmployee> = {},
): FrappeEmployee => {
  const employee: FrappeEmployee = {
    company_email: `${id}-${run}@tagaroa.example`,
    employee_name: `Employee ${id}`,
    name: `HR-EMP-${id}-${run}`,
    personal_email: `${id}-${run}@home.example`,
    relieving_date: null,
    status: "Active",
    ...record,
  };
  frappe.employees.set(employee.name, employee);
  return employee;
};

const sign = (body: string, secret = SECRET) =>
  createHmac("sha256", secret).update(body).digest("base64");

const post = (body: string, signature: string) =>
  fetch(`${baseURL}/api/hr/webhooks/frappe`, {
    body,
    headers: {
      "content-type": "application/json",
      "x-frappe-webhook-signature": signature,
    },
    method: "POST",
  });

/** Frappe's webhook on Employee, signed as Frappe signs it. */
const webhook = async (employee: FrappeEmployee) => {
  const body = JSON.stringify({ name: employee.name });
  expect((await post(body, sign(body))).status).toBe(204);
};

const accounts = (email: string | null) =>
  db
    .select()
    .from(user)
    .where(eq(user.email, email ?? ""));

const account = async (employee: FrappeEmployee) =>
  (await accounts(employee.company_email))[0];

const mail = (to: string | null) =>
  db
    .select()
    .from(notificationMessage)
    .where(eq(notificationMessage.destination, to ?? ""));

const linkOf = async (employee: FrappeEmployee) =>
  (
    await db
      .select()
      .from(employeeAccount)
      .where(eq(employeeAccount.employee, employee.name))
  )[0]?.userId;

const reconcile = () => app.get(ReconcileEmployeesUseCase).execute();

test("a signed webhook is accepted and a tampered one refused", async () => {
  const employee = hire("signed");
  const body = JSON.stringify({ name: employee.name });
  const tampered = JSON.stringify({ name: `${employee.name}-X` });

  expect((await post(body, "")).status).toBe(401);
  expect((await post(tampered, sign(body))).status).toBe(401);
  expect((await post(body, sign(body, `${SECRET}-other`))).status).toBe(401);
  expect(await account(employee)).toBeUndefined();

  expect((await post(body, sign(body))).status).toBe(204);
  expect(await account(employee)).toBeDefined();
});

test("a joiner is issued an ordinary account and their onboarding email queued", async () => {
  const employee = hire("join", { employee_name: "Grace Hopper" });
  await webhook(employee);

  const issued = await account(employee);
  expect(issued).toMatchObject({
    banned: false,
    emailVerified: true,
    mustChangePassword: true,
    name: "Grace Hopper",
    personalEmail: employee.personal_email,
    role: "user",
  });
  expect((await mail(employee.personal_email)).map((m) => m.key)).toEqual([
    "account.issued",
  ]);
  expect(await linkOf(employee)).toBe(issued!.id);

  // A repeat, from the webhook or the pass, finds the account and stops.
  await webhook(employee);
  await reconcile();
  expect(await accounts(employee.company_email)).toHaveLength(1);
  expect(await mail(employee.personal_email)).toHaveLength(1);
});

test("a leaver is offboarded once their relieving date has come", async () => {
  const employee = hire("leave");
  await webhook(employee);
  const issued = (await account(employee))!;
  await db.insert(session).values({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    updatedAt: new Date(),
    userId: issued.id,
  });

  employee.status = "Left";
  employee.relieving_date = "2999-01-01";
  await reconcile();
  expect((await account(employee))?.banned).toBe(false);

  employee.relieving_date = new Date().toISOString().slice(0, 10);
  await reconcile();
  expect((await account(employee))?.banned).toBe(true);
  expect(
    await db.select().from(session).where(eq(session.userId, issued.id)),
  ).toEqual([]);
  const events = await app.get<AuditTrail>(AUDIT_TRAIL).recent(50);
  expect(
    events.find(
      (event) =>
        event.type === "user.offboarded" && event.targetUserId === issued.id,
    ),
  ).toMatchObject({ actorId: null });
});

test("an account already holding the company email is adopted, not issued again", async () => {
  const employee = hire("adopt");
  const byHand = await app.get<AccountLifecycle>(ACCOUNT_LIFECYCLE).issue({
    email: employee.company_email!,
    name: "Issued by hand",
    personalEmail: `adopt-hand-${run}@home.example`,
    source: "integration test",
  });

  await webhook(employee);
  expect((await accounts(employee.company_email)).map((u) => u.id)).toEqual([
    byHand.id,
  ]);
  expect(await linkOf(employee)).toBe(byHand.id);
  expect(await mail(employee.personal_email)).toEqual([]);
});

test("a personal email equal to the workspace address is refused", async () => {
  const company = `same-${run}@tagaroa.example`;
  const employee = hire("same", {
    company_email: company,
    personal_email: company.toUpperCase(),
  });
  await webhook(employee);
  await reconcile();
  expect(await account(employee)).toBeUndefined();
  expect(await mail(employee.personal_email)).toEqual([]);
});

test("Inactive, Suspended and deleted records change nothing", async () => {
  const inactive = hire("inactive", { status: "Inactive" });
  const suspended = hire("suspended", { status: "Suspended" });
  await webhook(inactive);
  await webhook(suspended);
  await reconcile();
  expect(await account(inactive)).toBeUndefined();
  expect(await account(suspended)).toBeUndefined();

  // An account issued while Active outlives each of these in HR.
  const employee = hire("unchanged");
  await webhook(employee);
  const issued = (await account(employee))!;
  for (const status of ["Inactive", "Suspended"] as const) {
    employee.status = status;
    await webhook(employee);
    await reconcile();
    expect(await account(employee)).toMatchObject({
      banned: false,
      id: issued.id,
    });
  }

  frappe.employees.delete(employee.name);
  await webhook(employee);
  await reconcile();
  expect(await account(employee)).toMatchObject({
    banned: false,
    id: issued.id,
  });
});

test("an account suspended here stays suspended while HR shows it Active", async () => {
  const employee = hire("held");
  await webhook(employee);
  const issued = (await account(employee))!;
  await app
    .get<AccountLifecycle>(ACCOUNT_LIFECYCLE)
    .retire(issued.id, "Suspended by an administrator");

  await webhook(employee);
  await reconcile();
  expect(await accounts(employee.company_email)).toMatchObject([
    { banned: true, id: issued.id },
  ]);
});

test("two simultaneous ticks reconcile once: the advisory lock admits one replica", async () => {
  const employee = hire("lock");
  const replicaA = app.get(HrReconciler);
  const replicaB = new HrReconciler(
    app.get(ReconcileEmployeesUseCase),
    db,
    app.get<HrOptions>(HR_OPTIONS),
  );
  const before = frappe.lists();
  const held = frappe.hold();

  const tickA = replicaA.tick();
  // A holds the lock while it waits on the roster; B's tick now overlaps it.
  await held.reached;
  await replicaB.tick();
  expect(frappe.lists()).toBe(before + 1);
  expect(await account(employee)).toBeUndefined();

  held.release();
  await tickA;
  expect(await accounts(employee.company_email)).toHaveLength(1);
  expect(await mail(employee.personal_email)).toHaveLength(1);

  // The lock went with A's transaction: the next tick runs.
  await replicaB.tick();
  expect(frappe.lists()).toBe(before + 2);
});
