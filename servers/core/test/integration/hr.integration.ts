import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { createHmac } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { SQL } from "bun";
import { eq } from "drizzle-orm";

import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../../src/modules/audit/application/audit.facade";
import {
  session,
  user,
} from "../../src/modules/auth/infrastructure/persistence/drizzle/schema";
import { ReconcileEmployeesUseCase } from "../../src/modules/hr/application/use-cases/reconcile-employees.use-case";
import { employeeAccount } from "../../src/modules/hr/infrastructure/persistence/drizzle/schema";
import {
  HrReconciler,
  RECONCILE_LOCK,
} from "../../src/modules/hr/infrastructure/scheduling/hr.reconciler";
import { notificationMessage } from "../../src/modules/notification/infrastructure/persistence/drizzle/schema";
import {
  DATABASE,
  type Database,
} from "../../src/platform/database/database.module";
import { prepareTestDatabase, testEnv } from "../database";

setDefaultTimeout(60_000);

const SECRET = "frappe-webhook-secret-at-least-32-chars";
const run = crypto.randomUUID().slice(0, 8);
const employee = {
  company_email: `hr-${run}@tagaroa.example`,
  employee_name: "Grace Hopper",
  name: `HR-EMP-${run}`,
  personal_email: `grace-${run}@home.example`,
  relieving_date: null as string | null,
  status: "Active",
};

/** Further employees, listed but never fetched one by one. */
const roster: (typeof employee)[] = [];

/** The startup pass must not see the roster, or it races the first test. */
let listed = false;

/** Frappe's REST API, as far as the connector reads it. */
const frappe = Bun.serve({
  port: 0,
  fetch(request) {
    if (request.headers.get("authorization") !== "token key:secret")
      return new Response(null, { status: 401 });
    const path = new URL(request.url).pathname;
    if (path === `/api/resource/Employee/${employee.name}/`)
      return Response.json({ data: employee });
    if (path === "/api/resource/Employee")
      return Response.json({ data: listed ? [employee, ...roster] : [] });
    return new Response(null, { status: 404 });
  },
});

let app: INestApplication;
let baseURL: string;
let db: Database;

beforeAll(async () => {
  await prepareTestDatabase();
  Object.assign(process.env, testEnv, {
    FRAPPE_API_KEY: "key",
    FRAPPE_API_SECRET: "secret",
    FRAPPE_URL: frappe.url.origin,
    FRAPPE_WEBHOOK_SECRET: SECRET,
  });
  const { createApplication } = await import("../../src/application");
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  baseURL = await app.getUrl();
  db = app.get<Database>(DATABASE);
  // The reconciler starts a pass on bootstrap; let it finish against the empty roster.
  const reconciler = app.get(HrReconciler) as unknown as { running: boolean };
  while (reconciler.running) await Bun.sleep(10);
  listed = true;
});

afterAll(async () => {
  await app?.close();
  await frappe.stop();
});

const webhook = (body: string, signature: string) =>
  fetch(`${baseURL}/api/hr/webhooks/frappe`, {
    body,
    headers: {
      "content-type": "application/json",
      "x-frappe-webhook-signature": signature,
    },
    method: "POST",
  });

const sign = (body: string) =>
  createHmac("sha256", SECRET).update(body).digest("base64");

const account = async () =>
  (
    await db.select().from(user).where(eq(user.email, employee.company_email))
  )[0];

test("an unsigned or mis-signed webhook is refused", async () => {
  const body = JSON.stringify({ name: employee.name });
  expect((await webhook(body, "")).status).toBe(401);
  expect((await webhook(body, sign("{}"))).status).toBe(401);
  expect(await account()).toBeUndefined();
});

test("a joiner is issued an account the way an administrator would issue it", async () => {
  const body = JSON.stringify({ name: employee.name });
  expect((await webhook(body, sign(body))).status).toBe(204);

  const issued = await account();
  expect(issued).toMatchObject({
    banned: false,
    emailVerified: true,
    mustChangePassword: true,
    name: "Grace Hopper",
    personalEmail: employee.personal_email,
    role: "user",
  });

  const [welcome] = await db
    .select()
    .from(notificationMessage)
    .where(eq(notificationMessage.destination, employee.personal_email));
  expect(welcome?.key).toBe("account.issued");

  const [link] = await db
    .select()
    .from(employeeAccount)
    .where(eq(employeeAccount.employee, employee.name));
  expect(link?.userId).toBe(issued!.id);

  // A repeated webhook finds the account and leaves it alone.
  expect((await webhook(body, sign(body))).status).toBe(204);
  expect((await account())?.id).toBe(issued!.id);
});

test("a leaver is offboarded by the reconciliation pass on their relieving date", async () => {
  const issued = (await account())!;
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
  await app.get(ReconcileEmployeesUseCase).execute();
  expect((await account())?.banned).toBe(false);

  employee.relieving_date = new Date().toISOString().slice(0, 10);
  await app.get(ReconcileEmployeesUseCase).execute();
  expect((await account())?.banned).toBe(true);
  expect(
    await db.select().from(session).where(eq(session.userId, issued.id)),
  ).toEqual([]);

  const events = await app.get<AuditTrail>(AUDIT_TRAIL).recent(20);
  expect(
    events.find(
      (event) =>
        event.type === "user.offboarded" && event.targetUserId === issued.id,
    ),
  ).toMatchObject({ actorId: null });
});

test("a pass waits its turn while another replica holds the lock", async () => {
  const joiner = {
    ...employee,
    company_email: `hr-lock-${run}@tagaroa.example`,
    name: `HR-EMP-LOCK-${run}`,
    personal_email: `lock-${run}@home.example`,
    relieving_date: null,
    status: "Active",
  };
  roster.push(joiner);
  const issued = async () =>
    (
      await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, joiner.company_email))
    ).length;

  const other = new SQL(testEnv.DATABASE_URL, { max: 1 });
  try {
    await other`select pg_advisory_lock(${RECONCILE_LOCK})`;
    await app.get(HrReconciler).tick();
    expect(await issued()).toBe(0);

    await other`select pg_advisory_unlock(${RECONCILE_LOCK})`;
    await app.get(HrReconciler).tick();
    expect(await issued()).toBe(1);
  } finally {
    await other.close();
  }
});
