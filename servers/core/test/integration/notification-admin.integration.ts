import { expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import {
  DATABASE,
  type Database,
} from "../../src/platform/database/database.module";
import { testEnv } from "../database";
import {
  adminCookie,
  app,
  issueAccount,
  request,
  serveCore,
  signIn,
} from "./harness";

serveCore();

test("template edits validate freshness and atomically reject concurrent overwrites", async () => {
  const cookie = await adminCookie();
  const draft = {
    key: `qa.concurrent.${crypto.randomUUID().replaceAll("-", "")}`,
    channel: "sms",
    locale: "en",
    subject: null,
    body: "Original wording",
    variables: [],
    secrets: [],
  };
  const created = await request("/api/notifications/templates", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify(draft),
  });
  expect(created.status).toBe(201);
  const { id } = await created.json();
  const client = app.get<Database>(DATABASE).$client;
  try {
    // JS reads millisecond precision; PostgreSQL defaults include microseconds.
    await client`update notification.template set updated_at = timestamp '2026-01-01 00:00:00.123456' where id = ${id}`;
    const path = `/api/notifications/templates/${id}`;
    for (const expectedUpdatedAt of [undefined, "not-a-date"]) {
      const invalid = await request(path, {
        method: "PUT",
        headers: { cookie },
        body: JSON.stringify({ ...draft, expectedUpdatedAt }),
      });
      expect(invalid.status).toBe(400);
      expect((await invalid.json()).details).toEqual([
        {
          field: "expectedUpdatedAt",
          message: "expectedUpdatedAt must be a valid timestamp",
        },
      ]);
    }
    const expectedUpdatedAt = "2026-01-01T00:00:00.123Z";
    const responses = await Promise.all(
      ["First writer", "Second writer"].map((body) =>
        request(path, {
          method: "PUT",
          headers: { cookie },
          body: JSON.stringify({ ...draft, body, expectedUpdatedAt }),
        }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      204, 409,
    ]);
    const [stored] =
      await client`select body, updated_at from notification.template where id = ${id}`;
    const winner =
      responses[0]!.status === 204 ? "First writer" : "Second writer";
    expect(stored.body).toBe(winner);
    const obsolete = await request(path, {
      method: "PUT",
      headers: { cookie },
      body: JSON.stringify({ ...draft, expectedUpdatedAt }),
    });
    expect(obsolete.status).toBe(409);
    const fresh = await request(path, {
      method: "PUT",
      headers: { cookie },
      body: JSON.stringify({
        ...draft,
        body: "Fresh revision",
        expectedUpdatedAt: new Date(stored.updated_at).toISOString(),
      }),
    });
    expect(fresh.status).toBe(204);
    const [revised] =
      await client`select body, updated_at from notification.template where id = ${id}`;
    expect(revised.body).toBe("Fresh revision");
    expect(new Date(revised.updated_at).getTime()).toBeGreaterThan(
      new Date(stored.updated_at).getTime(),
    );
    const missing = await request(
      `/api/notifications/templates/${crypto.randomUUID()}`,
      {
        method: "PUT",
        headers: { cookie },
        body: JSON.stringify({ ...draft, expectedUpdatedAt }),
      },
    );
    expect(missing.status).toBe(404);
  } finally {
    await client`delete from notification.template where id = ${id}`;
  }
});

test("templates validate and persist create, edit, publish, version and delete across channels", async () => {
  const cookie = await adminCookie();
  const send = (path: string, method: string, body?: unknown) =>
    request(path, {
      method,
      headers: { cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const empty = await send("/api/notifications/templates", "POST", {});
  expect(empty.status).toBe(400);
  expect(await empty.json()).toEqual({
    details: [
      { field: "key", message: "key is required" },
      {
        field: "channel",
        message: "channel is required",
      },
      { field: "body", message: "body is required" },
      { field: "locale", message: "locale is required" },
    ],
    error: "Bad Request",
    message: "key is required",
    statusCode: 400,
  });
  for (const channel of ["email", "sms", "whatsapp"] as const) {
    const key = `qa.${crypto.randomUUID().replaceAll("-", "")}`;
    const draft = {
      key,
      channel,
      locale: "en",
      body: channel === "whatsapp" ? "qa_welcome" : "Hello {{name}}",
      subject: "QA welcome",
      variables: ["name"],
      secrets: [],
    };
    const created = await send("/api/notifications/templates", "POST", draft);
    expect(created.status).toBe(201);
    const { id, version } = await created.json();
    expect(version).toBe(1);
    const initial = await (
      await send(`/api/notifications/templates?q=${key}`, "GET")
    ).json();
    const updatedAt = initial.data.find(
      (row: { id: string }) => row.id === id,
    ).updatedAt;
    expect(
      (
        await send(`/api/notifications/templates/${id}`, "PUT", {
          ...draft,
          expectedUpdatedAt: updatedAt,
          body: channel === "whatsapp" ? "qa_updated" : "Updated {{name}}",
        })
      ).status,
    ).toBe(204);
    const listed = await (
      await send(`/api/notifications/templates?q=${key}`, "GET")
    ).json();
    expect(listed.data.find((row: { id: string }) => row.id === id).body).toBe(
      channel === "whatsapp" ? "qa_updated" : "Updated {{name}}",
    );
    expect(
      (await send(`/api/notifications/templates/${id}/publish`, "POST")).status,
    ).toBe(204);
    expect(
      (
        await send(`/api/notifications/templates/${id}`, "PUT", {
          ...draft,
          expectedUpdatedAt: updatedAt,
        })
      ).status,
    ).toBe(404);
    expect(
      (await send(`/api/notifications/templates/${id}`, "DELETE")).status,
    ).toBe(404);
    const next = await send("/api/notifications/templates", "POST", draft);
    const nextDraft = await next.json();
    expect(nextDraft.version).toBe(2);
    expect(
      (await send(`/api/notifications/templates/${nextDraft.id}`, "DELETE"))
        .status,
    ).toBe(204);
  }
});

test("publishing wording and lifting a suppression each leave one audit row naming the operator", async () => {
  const cookie = await adminCookie();
  const send = (path: string, method: string, body?: unknown) =>
    request(path, {
      method,
      headers: { cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const operator = await (await send("/api/auth/get-session", "GET")).json();
  const key = `qa.${crypto.randomUUID().replaceAll("-", "")}`;
  const created = await send("/api/notifications/templates", "POST", {
    key,
    channel: "email",
    locale: "en",
    body: "Hello {{name}}",
    subject: "QA audit",
    variables: ["name"],
    secrets: [],
  });
  expect(created.status).toBe(201);
  const { id } = await created.json();
  expect(
    (await send(`/api/notifications/templates/${id}/publish`, "POST")).status,
  ).toBe(204);

  const sql = app.get<Database>(DATABASE).$client;
  const suppressionId = crypto.randomUUID();
  const destination = `bounced-${suppressionId}@tagaroa.test`;
  await sql`
    insert into notification.suppression (id, channel, destination, reason)
    values (${suppressionId}, 'email', ${destination}, 'bounced')
  `;
  expect(
    (await send(`/api/notifications/suppressions/${suppressionId}`, "DELETE"))
      .status,
  ).toBe(204);

  const rows = await sql`
    select type, detail from directory.auth_audit_event
    where actor_id = ${operator.user.id}
      and type in ('notification.template.published', 'notification.suppression.removed')
  `;
  expect(rows).toHaveLength(2);
  expect(rows).toContainEqual({
    detail: `${key}:email:en:v1`,
    type: "notification.template.published",
  });
  expect(rows).toContainEqual({
    detail: `email:${suppressionId}`,
    type: "notification.suppression.removed",
  });
  // The trail names the act, never where the message would have gone.
  expect(JSON.stringify(rows)).not.toContain(destination);
});

test("a password-reset wording published without secrets still keeps the password out of the message log", async () => {
  const admin = await adminCookie();
  const send = (path: string, method: string, body?: unknown) =>
    request(path, {
      method,
      headers: { cookie: admin },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  // The seeded wording, republished with nothing marked secret.
  const created = await send("/api/notifications/templates", "POST", {
    key: "account.password-reset",
    channel: "email",
    locale: "en",
    subject: "Your Tagaroa password was reset",
    body: "{{name}},\n\nAddress: {{email}}\nTemporary password: {{password}}",
    variables: ["name", "email", "password"],
    secrets: [],
  });
  expect(created.status).toBe(201);
  const { id } = await created.json();
  expect(
    (await send(`/api/notifications/templates/${id}/publish`, "POST")).status,
  ).toBe(204);

  const employee = await issueAccount("UnmaskedFixturePassword123!");
  const target = await (await signIn(employee.email, employee.password)).json();
  const password = "UnmaskedResetFixture123!";
  const reset = await request("/api/auth/admin/set-user-password", {
    method: "POST",
    headers: { cookie: await adminCookie("super-admin") },
    body: JSON.stringify({ userId: target.user.id, newPassword: password }),
  });
  expect(reset.status).toBe(200);

  const listed = await send(
    `/api/notifications/messages?q=${encodeURIComponent(`personal.${employee.email}`)}`,
    "GET",
  );
  expect(listed.status).toBe(200);
  const messages = await listed.json();
  expect(
    messages.data.some(
      (row: { key: string; body: string }) =>
        row.key === "account.password-reset" &&
        row.body.includes("Temporary password: {{password}}"),
    ),
  ).toBe(true);
  expect(JSON.stringify(messages)).not.toContain(password);
});

test("concurrent template creation returns a saved draft or a retryable conflict", async () => {
  const cookie = await adminCookie();
  const draft = {
    key: `qa.${crypto.randomUUID().replaceAll("-", "")}`,
    channel: "email",
    locale: "en",
    body: "Concurrent draft",
    subject: "QA concurrency",
    variables: [],
    secrets: [],
  };
  const responses = await Promise.all(
    Array.from({ length: 4 }, () =>
      request("/api/notifications/templates", {
        method: "POST",
        headers: { cookie },
        body: JSON.stringify(draft),
      }),
    ),
  );
  expect(responses.some((response) => response.status === 201)).toBe(true);
  for (const response of responses)
    expect([201, 409]).toContain(response.status);
});

test("webhooks verify original JSON bytes and reject altered or unsigned payloads", async () => {
  const raw = '{ "entry" : [] }';
  const signature = `sha256=${createHmac("sha256", testEnv.WHATSAPP_APP_SECRET).update(raw).digest("hex")}`;
  const signed = await request("/api/notifications/webhooks/meta", {
    method: "POST",
    headers: { "x-hub-signature-256": signature },
    body: raw,
  });
  expect(signed.status).toBe(204);
  expect(
    (
      await request("/api/notifications/webhooks/meta", {
        method: "POST",
        headers: { "x-hub-signature-256": signature },
        body: JSON.stringify({ entry: [] }),
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await request("/api/notifications/webhooks/meta", {
        method: "POST",
        body: raw,
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await request("/api/notifications/webhooks/unknown", {
        method: "POST",
        body: raw,
      })
    ).status,
  ).toBe(404);
});
