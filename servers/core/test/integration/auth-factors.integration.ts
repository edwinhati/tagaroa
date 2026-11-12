import { expect, spyOn, test } from "bun:test";

import { authenticatorCode } from "@repo/test-support/totp";

import {
  DATABASE,
  type Database,
} from "../../src/platform/database/database.module";
import {
  adminCookie,
  app,
  bearerOf,
  challenge,
  cookieJar,
  enrolledEmployee,
  issueAccount,
  request,
  serveCore,
  sessionCookie,
  signIn,
  startEnrolment,
  userIdOf,
} from "./harness";

serveCore();

test("TOTP accepts adjacent windows at rollover and rejects two-window drift", async () => {
  const employee = await issueAccount("QaBoundaryPassword123!");
  const client = app.get<Database>(DATABASE).$client;
  await client`update auth."user" set must_change_password = false where email = ${employee.email}`;
  let cookie = sessionCookie(await signIn(employee.email, employee.password))!;
  const enabled = await request("/api/auth/two-factor/enable", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({ password: employee.password, method: "totp" }),
  });
  expect(enabled.status).toBe(200);
  const { totpURI } = await enabled.json();
  const boundary = Math.floor(Date.now() / 30_000) * 30_000;
  const now = spyOn(Date, "now");
  try {
    for (const [time, offset, status] of [
      [boundary + 29_999, -2, 401],
      [boundary + 29_999, 2, 401],
      [boundary + 29_999, -1, 200],
      [boundary + 30_000, -1, 200],
      [boundary + 30_000, 0, 200],
      [boundary + 30_000, 1, 200],
    ] as const) {
      now.mockReturnValue(time);
      const verified = await request("/api/auth/two-factor/verify-totp", {
        method: "POST",
        headers: { cookie },
        body: JSON.stringify({
          code: authenticatorCode(totpURI, time + offset * 30_000),
          trustDevice: false,
        }),
      });
      expect(verified.status).toBe(status);
      if (status === 401)
        expect((await verified.json()).code).toBe("INVALID_CODE");
      cookie = sessionCookie(verified) ?? cookie;
    }
  } finally {
    now.mockRestore();
  }
});

test("an abandoned authenticator enrolment leaves no half-enrolled factor", async () => {
  const { employee, jar, enable } = await startEnrolment(
    "QaAbandonPassword123!",
  );
  const abandoned = await enable();

  // Reloading before the first code is verified must not switch MFA on.
  const reloaded = await signIn(employee.email, employee.password);
  expect(reloaded.status).toBe(200);
  expect((await reloaded.json()).twoFactorRedirect).toBeUndefined();

  const resumed = await enable();
  expect(resumed.totpURI).not.toBe(abandoned.totpURI);
  expect(
    await app.get<Database>(DATABASE).$client`
      select verified from auth.two_factor
      where user_id = (select id from auth."user" where email = ${employee.email})
    `,
  ).toEqual([{ verified: false }]);
  const stale = await jar.post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(abandoned.totpURI),
  });
  expect(stale.status).toBe(401);
  expect((await stale.json()).code).toBe("INVALID_CODE");
  const verified = await jar.post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(resumed.totpURI),
  });
  expect(verified.status).toBe(200);

  const pending = await challenge(employee);
  const staleCode = await pending.post(
    "/api/auth/two-factor/verify-backup-code",
    { code: abandoned.backupCodes[0] },
  );
  expect(staleCode.status).toBe(401);
  expect((await staleCode.json()).code).toBe("INVALID_BACKUP_CODE");
  const currentCode = await pending.post(
    "/api/auth/two-factor/verify-backup-code",
    { code: resumed.backupCodes[0] },
  );
  expect(currentCode.status).toBe(200);
});

test("exhausted recovery codes are refused and the authenticator still signs in", async () => {
  const employee = await enrolledEmployee("QaExhaustPassword123!");
  expect(employee.backupCodes).toHaveLength(10);
  for (const code of employee.backupCodes) {
    const used = await (
      await challenge(employee)
    ).post("/api/auth/two-factor/verify-backup-code", { code });
    expect(used.status).toBe(200);
  }

  // Five misses spend a challenge. The account locks after ten consecutive
  // misses, so an authenticator sign-in between the halves resets that count.
  for (const codes of [
    employee.backupCodes.slice(0, 5),
    employee.backupCodes.slice(5),
  ]) {
    const pending = await challenge(employee);
    for (const code of codes) {
      const reused = await pending.post(
        "/api/auth/two-factor/verify-backup-code",
        { code },
      );
      expect(reused.status).toBe(401);
      expect((await reused.json()).code).toBe("INVALID_BACKUP_CODE");
    }
    const spent = await pending.post("/api/auth/two-factor/verify-totp", {
      code: authenticatorCode(employee.totpURI),
    });
    expect(spent.status).toBe(400);
    expect((await spent.json()).code).toBe(
      "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
    );
    const recovered = await (
      await challenge(employee)
    ).post("/api/auth/two-factor/verify-totp", {
      code: authenticatorCode(employee.totpURI),
    });
    expect(recovered.status).toBe(200);
  }
});

test("trusted devices and pending challenges stop working once expired", async () => {
  const employee = await enrolledEmployee("QaExpiryPassword123!");
  const client = app.get<Database>(DATABASE).$client;
  const device = await challenge(employee);
  const trusted = await device.post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(employee.totpURI),
    trustDevice: true,
  });
  expect(trusted.status).toBe(200);
  expect(device.has("trust_device")).toBe(true);
  expect((await device.post("/api/auth/sign-out", {})).status).toBe(200);

  const skipped = await device.post("/api/auth/sign-in/email", employee);
  expect(skipped.status).toBe(200);
  expect((await skipped.json()).twoFactorRedirect).toBeUndefined();
  expect((await device.post("/api/auth/sign-out", {})).status).toBe(200);

  // Thirty days are simulated by ageing the server-side trust record.
  await client`
    update auth.verification set expires_at = now() - interval '1 second'
    where identifier like 'trust-device-%'
    and value = (select id from auth."user" where email = ${employee.email})
  `;
  const pending = await challenge(employee, device);
  await client`
    update auth.verification set expires_at = now() - interval '1 second'
    where value = (select id from auth."user" where email = ${employee.email})
    and identifier not like 'trust-device-%'
  `;
  const expired = await pending.post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(employee.totpURI),
  });
  expect(expired.status).toBe(401);
  expect((await expired.json()).code).toBe("INVALID_TWO_FACTOR_COOKIE");

  const fresh = await (
    await challenge(employee, pending)
  ).post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(employee.totpURI),
  });
  expect(fresh.status).toBe(200);
});

test("factor recovery requires independent verification, replaces credentials once and revokes every old factor and session", async () => {
  const issued = await issueAccount("LostFactorsPassword123!");
  const login = await signIn(issued.email, issued.password);
  const person = await login.json();
  const sql = app.get<Database>(DATABASE).$client;
  await sql`update auth."user" set must_change_password = false, two_factor_enabled = true, role = 'admin' where id = ${person.user.id}`;
  await sql`insert into auth.two_factor (id, user_id, secret, backup_codes) values (${crypto.randomUUID()}, ${person.user.id}, 'fixture-secret', 'fixture-backup')`;
  await sql`insert into auth.verification (id, identifier, value, expires_at, created_at, updated_at) values (${crypto.randomUUID()}, ${`trust-device-${crypto.randomUUID()}`}, ${person.user.id}, now() + interval '1 day', now(), now())`;
  await sql`insert into auth.passkey (id, user_id, public_key, credential_id, counter, device_type, backed_up) values (${crypto.randomUUID()}, ${person.user.id}, 'fixture-public-key', ${crypto.randomUUID()}, 0, 'singleDevice', false)`;
  const requester = await adminCookie("super-admin");
  const reviewer = await adminCookie("super-admin");
  const send = (path: string, body: unknown, cookie = requester) =>
    request(path, {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify(body),
    });
  const input = {
    reason: "Employee lost all authentication factors",
    evidence: "HR callback and manager verified; case REC-123",
    identityVerified: true,
  };
  const path = `/api/auth-management/users/${person.user.id}/factor-recovery`;
  expect((await send(path, { ...input, identityVerified: false })).status).toBe(
    400,
  );
  const requested = await send(path, input);
  expect(requested.status).toBe(201);
  const recoveryId = (await requested.json()).data.id;
  const approvePath = `/api/auth-management/recoveries/${recoveryId}/approve`;
  await sql`update auth.two_factor set failed_verification_count = 1 where user_id = ${person.user.id}`;
  expect((await send(approvePath, input)).status).toBe(403);
  expect(
    (await send(approvePath, input, await adminCookie("helpdesk"))).status,
  ).toBe(403);
  const approvals = await Promise.all([
    send(approvePath, input, reviewer),
    send(approvePath, input, reviewer),
  ]);
  expect(approvals.map((response) => response.status).sort()).toEqual([
    201, 409,
  ]);
  expect(
    approvals
      .find((response) => response.status === 201)!
      .headers.get("cache-control"),
  ).toBe("no-store");
  const completed = await approvals
    .find((response) => response.status === 201)!
    .json();
  expect(completed.data.temporaryPassword.length).toBeGreaterThanOrEqual(24);
  expect((await signIn(issued.email, issued.password)).status).toBe(401);
  const replacement = await signIn(
    issued.email,
    completed.data.temporaryPassword,
  );
  expect(replacement.status).toBe(200);
  const recovered = await replacement.json();
  expect(recovered.user.mustChangePassword).toBe(true);
  expect(recovered.user.twoFactorEnabled).toBe(false);
  expect(
    await (
      await request("/api/auth/get-session", {
        headers: { cookie: sessionCookie(login)! },
      })
    ).json(),
  ).toBeNull();
  expect(
    await sql`select id from auth.two_factor where user_id = ${person.user.id}`,
  ).toHaveLength(0);
  expect(
    await sql`select id from auth.verification where value = ${person.user.id}`,
  ).toHaveLength(0);
  expect(
    await sql`select id from auth.passkey where user_id = ${person.user.id}`,
  ).toHaveLength(0);
  const stored =
    await sql`select * from identity_operations.factor_recovery where id = ${recoveryId}`;
  expect(JSON.stringify(stored)).not.toContain(
    completed.data.temporaryPassword,
  );
  expect(stored[0].approved_by).toBeTruthy();
  const recoveredCookie = sessionCookie(replacement)!;
  expect(
    (await request("/api/directory", { headers: { cookie: recoveredCookie } }))
      .status,
  ).toBe(403);
  const changed = await request("/api/auth/change-password", {
    method: "POST",
    headers: { cookie: recoveredCookie },
    body: JSON.stringify({
      currentPassword: completed.data.temporaryPassword,
      newPassword: "RecoveredAdminPassword123!",
      revokeOtherSessions: true,
    }),
  });
  expect(changed.status).toBe(200);
  const stillBlocked = await request("/api/directory", {
    headers: { cookie: sessionCookie(changed) ?? recoveredCookie },
  });
  expect(stillBlocked.status).toBe(403);
  expect((await stillBlocked.json()).code).toBe(
    "PRIVILEGED_TWO_FACTOR_REQUIRED",
  );
});

test("stale recovery evidence cannot reset a changed account and a new verified request may replace it", async () => {
  const targetCookie = await adminCookie("admin");
  const person = await (
    await request("/api/auth/get-session", {
      headers: { cookie: targetCookie },
    })
  ).json();
  const sql = app.get<Database>(DATABASE).$client;
  // Test-helper users have no password account; add a fixture credential without enabling login.
  await sql`insert into auth.account (id, account_id, provider_id, user_id, password, created_at, updated_at) values (${crypto.randomUUID()}, ${person.user.id}, 'credential', ${person.user.id}, 'fixture-hash', now(), now())`;
  const cookie = await adminCookie("helpdesk");
  const approver = await adminCookie("super-admin");
  const input = {
    reason: "Lost registered authenticator",
    evidence: "Verified manager callback; case REC-456",
    identityVerified: true,
  };
  const path = `/api/auth-management/users/${person.user.id}/factor-recovery`;
  const send = (url: string, authCookie: string) =>
    request(url, {
      method: "POST",
      headers: { cookie: authCookie },
      body: JSON.stringify(input),
    });
  const created = await send(path, cookie);
  expect(created.status).toBe(201);
  const id = (await created.json()).data.id;
  await sql`update auth."user" set name = 'Changed while pending' where id = ${person.user.id}`;
  expect(
    (await send(`/api/auth-management/recoveries/${id}/approve`, approver))
      .status,
  ).toBe(409);
  const replacementRequest = await send(path, cookie);
  expect(replacementRequest.status).toBe(201);
  const replacementId = (await replacementRequest.json()).data.id;
  await sql`update identity_operations.factor_recovery set expires_at = now() - interval '1 second' where id = ${replacementId}`;
  expect(
    (
      await send(
        `/api/auth-management/recoveries/${replacementId}/approve`,
        approver,
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await (
        await request("/api/auth/get-session", {
          headers: { cookie: targetCookie },
        })
      ).json()
    ).user.id,
  ).toBe(person.user.id);
});

test("an identity admin cannot rewrite second-factor or temporary-password state", async () => {
  const employee = await issueAccount("GuardedFields123!");
  const userId = await userIdOf(employee.email);
  const sql = app.get<Database>(DATABASE).$client;
  await sql`update auth."user" set two_factor_enabled = true where id = ${userId}`;
  const cookie = await adminCookie();
  const update = (data: Record<string, unknown>) =>
    request("/api/auth/admin/update-user", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ userId, data }),
    });
  for (const data of [
    { twoFactorEnabled: false },
    { mustChangePassword: false },
    { temporaryPasswordExpiresAt: null },
    { banned: true },
    { name: "Renamed", emailVerified: false },
  ]) {
    const response = await update(data);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("USER_FIELD_NOT_EDITABLE");
  }
  const [row] =
    await sql`select name, two_factor_enabled, must_change_password, banned
    from auth."user" where id = ${userId}`;
  expect(row).toEqual({
    banned: false,
    must_change_password: true,
    name: "Integration Employee",
    two_factor_enabled: true,
  });
  expect((await update({ name: "Renamed Employee" })).status).toBe(200);
});

test("an expired temporary password is refused after the second factor too", async () => {
  const employee = await enrolledEmployee("ExpiringFactor123!");
  const sql = app.get<Database>(DATABASE).$client;
  await sql`update auth."user" set must_change_password = true,
    temporary_password_expires_at = now() + interval '1 hour' where email = ${employee.email}`;
  const jar = await challenge(employee);
  const verified = await jar.post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(employee.totpURI, Date.now() + 30_000),
  });
  expect(verified.status).toBe(200);
  await sql`update auth."user" set temporary_password_expires_at = now() - interval '1 second'
    where email = ${employee.email}`;

  const body = JSON.stringify({
    currentPassword: employee.password,
    newPassword: "ChosenTooLate123!",
  });
  for (const headers of [
    { cookie: jar.header() },
    { authorization: bearerOf(jar.header()) },
  ] as Record<string, string>[]) {
    const changed = await request("/api/auth/change-password", {
      method: "POST",
      headers,
      body,
    });
    expect(changed.status).toBe(403);
    expect((await changed.json()).code).toBe("TEMPORARY_PASSWORD_EXPIRED");
  }

  const again = await cookieJar().post("/api/auth/sign-in/email", employee);
  expect(again.status).toBe(403);
  expect((await again.json()).code).toBe("TEMPORARY_PASSWORD_EXPIRED");
  expect(
    again.headers
      .getSetCookie()
      .some((value) => /^better-auth\.session_token=[^;]/.test(value)),
  ).toBe(false);
});
