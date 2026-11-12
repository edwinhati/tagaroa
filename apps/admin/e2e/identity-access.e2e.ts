import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { hideDevOverlays } from "@repo/test-support/axe-audit";
import {
  E2E_ADMIN,
  E2E_ORIGINS,
  e2eOperator,
  TEST_DATABASE_URL,
} from "@repo/test-support/e2e-stack";
import { signInOperator } from "@repo/test-support/sign-in";
import { authenticatorCode } from "@repo/test-support/totp";
import { SQL } from "bun";

const operator = e2eOperator();

const adminOrigin = E2E_ORIGINS.admin;
const coreOrigin = E2E_ORIGINS.core;
const databaseUrl = TEST_DATABASE_URL;

async function filterAccounts(page: Page, email: string) {
  await page.getByRole("textbox", { name: "Filter accounts" }).fill(email);
  // The previous rows remain interactive while the debounced search settles.
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === email);
  await expect(page.getByRole("button", { name: /^Actions for / })).toHaveCount(
    1,
  );
}

/**
 * Buttons fade opacity (tagaroa.css) and dialogs fade in. Axe measuring either
 * mid-fade, such as Next enabling as a table's count arrives, reports the
 * blended colour as a contrast failure, so let finite animations finish first.
 * Endless ones (skeleton pulses) never would.
 */
const settleAnimations = (page: Page) =>
  page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().endTime !== Infinity,
        )
        .map((animation) => animation.finished),
    ),
  );

test.beforeEach(async ({ page, context }) => {
  await hideDevOverlays(context);
  await signInOperator(page, operator, adminOrigin);
});

test("account settings end one session and all other sessions while retaining this device", async ({
  page,
  browser,
  isMobile,
}) => {
  test.setTimeout(90000);
  const sql = new SQL(databaseUrl);
  const contexts: BrowserContext[] = [];
  const current = (
    await (await page.request.get(`${coreOrigin}/api/auth/get-session`)).json()
  ).session;
  try {
    await sql`delete from auth.session where user_id = ${current.userId} and id <> ${current.id}`;
    const createSession = async () => {
      await sql`update auth."user" set two_factor_enabled = false where email = ${operator.email}`;
      const context = await browser.newContext();
      contexts.push(context);
      const response = await context.request.post(
        `${coreOrigin}/api/auth/sign-in/email`,
        { data: operator, headers: { origin: adminOrigin } },
      );
      expect(response.ok()).toBe(true);
      await sql`update auth."user" set two_factor_enabled = true where email = ${operator.email}`;
      return context;
    };
    const openSessions = async () => {
      await page.goto(`${E2E_ORIGINS.workspace}/`);
      await expect(
        page.getByRole("heading", { name: "Home", exact: true }),
      ).toBeVisible();
      if (isMobile) await page.locator('[data-slot="sidebar-trigger"]').click();
      await page
        .getByRole("button", {
          name: `Account menu for ${operator.email.charAt(0).toUpperCase()} ${operator.email}`,
        })
        .click();
      await page.getByRole("menuitem", { name: "Account settings" }).click();
      await page.getByRole("tab", { name: "Sessions", exact: true }).click();
      await expect(
        page.getByRole("dialog").getByText("this device", { exact: false }),
      ).toBeVisible();
    };
    const other = await createSession();
    await openSessions();
    const revoked = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/revoke-session"),
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "End", exact: true })
      .click();
    expect((await revoked).ok()).toBe(true);
    expect(
      await (
        await other.request.get(
          `${coreOrigin}/api/auth/get-session?disableCookieCache=true`,
        )
      ).json(),
    ).toBeNull();
    await page.keyboard.press("Escape");
    const second = await createSession();
    const third = await createSession();
    await openSessions();
    const revokedOthers = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/revoke-other-sessions"),
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "End other sessions", exact: true })
      .click();
    expect((await revokedOthers).ok()).toBe(true);
    for (const context of [second, third])
      expect(
        await (
          await context.request.get(
            `${coreOrigin}/api/auth/get-session?disableCookieCache=true`,
          )
        ).json(),
      ).toBeNull();
    const remaining =
      await sql`select id from auth.session where user_id = ${current.userId}`;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(current.id);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Home", exact: true }),
    ).toBeVisible();
  } finally {
    await sql`update auth."user" set two_factor_enabled = true where email = ${operator.email}`;
    for (const context of contexts) await context.close();
    await sql.close();
  }
});

test("remaining account profile and sessions recover from failed reads", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000);
  await page.goto(`${E2E_ORIGINS.workspace}/`);
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  await page.route("**/api/directory/me", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "QA unavailable" }),
    }),
  );
  if (isMobile) await page.locator('[data-slot="sidebar-trigger"]').click();
  await page
    .getByRole("button", {
      name: `Account menu for ${operator.email.charAt(0).toUpperCase()} ${operator.email}`,
    })
    .click();
  await page.getByRole("menuitem", { name: "Account settings" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText(
    "Could not read your place in the group",
    { timeout: 20_000 },
  );
  await page.unroute("**/api/directory/me");
  await dialog.getByRole("button", { name: "Try again" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    dialog.getByRole("button", { name: "Manage", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await page.route("**/api/auth/list-sessions", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "QA sessions unavailable" }),
    }),
  );
  await dialog.getByRole("tab", { name: "Sessions", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 20_000 });
  await page.unroute("**/api/auth/list-sessions");
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByText("this device", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(
    page.locator('[data-slot="sidebar"][data-mobile="true"][role="dialog"]'),
  ).toHaveCount(0);
  await settleAnimations(page);
  const accessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: `/tmp/tagaroa-settings-${test.info().project.name}-light.png`,
  });
  await dialog.getByRole("tab", { name: "Sessions", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  if (isMobile) await page.locator('[data-slot="sidebar-trigger"]').click();
  await page.getByRole("button", { name: /^Theme:/ }).click();
  await page.getByRole("button", { name: /^Theme:/ }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page
    .getByRole("button", {
      name: `Account menu for ${operator.email.charAt(0).toUpperCase()} ${operator.email}`,
    })
    .click();
  await page.getByRole("menuitem", { name: "Account settings" }).click();
  await dialog.getByRole("tab", { name: "Sessions", exact: true }).click();
  await expect(dialog.getByText("this device", { exact: false })).toBeVisible();
  await expect(
    page.locator('[data-slot="sidebar"][data-mobile="true"][role="dialog"]'),
  ).toHaveCount(0);
  await settleAnimations(page);
  const darkAccessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(darkAccessibility.violations).toEqual([]);
  await page.screenshot({
    path: `/tmp/tagaroa-settings-${test.info().project.name}-dark.png`,
  });
});

test("account settings edit the display name, refuse admin-managed fields and retry a failed save", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000);
  const sql = new SQL(databaseUrl);
  const [original] =
    await sql`select id, name, personal_email from auth."user" where email = ${operator.email}`;
  const renamed = `QA Renamed ${test.info().project.name}`;
  // On a phone the account menu lives in the sidebar sheet, which closes with the dialog.
  const openAccountSettings = async () => {
    if (isMobile) await page.locator('[data-slot="sidebar-trigger"]').click();
    await page
      .getByRole("button", {
        name: `Account menu for ${operator.email.charAt(0).toUpperCase()} ${operator.email}`,
      })
      .click();
    await page.getByRole("menuitem", { name: "Account settings" }).click();
    return page.getByRole("dialog");
  };
  const openProfile = async () => {
    await page.goto(`${E2E_ORIGINS.workspace}/`);
    await expect(
      page.getByRole("heading", { name: "Home", exact: true }),
    ).toBeVisible();
    return openAccountSettings();
  };
  try {
    // The self-service route takes the display name and nothing an admin owns.
    const refused = await page.request.post(
      `${coreOrigin}/api/auth/update-user`,
      {
        data: { name: "Ada", personalEmail: "ada@example.test" },
        headers: { origin: E2E_ORIGINS.workspace },
      },
    );
    expect(refused.status()).toBe(400);
    expect((await refused.json()).message).toBe(
      "Only your name can be changed here.",
    );
    const [unchanged] =
      await sql`select name, personal_email from auth."user" where id = ${original.id}`;
    expect(unchanged).toEqual({
      name: original.name,
      personal_email: original.personal_email,
    });

    const dialog = await openProfile();
    await dialog.getByRole("button", { name: "Edit name" }).click();
    const input = dialog.getByRole("textbox", { name: "Name" });
    await expect(input).toBeFocused();
    await input.fill("   ");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Name is required.");
    await expect(input).toHaveAttribute("aria-invalid", "true");

    await page.route("**/api/auth/update-user", (route) => route.abort());
    await input.fill(renamed);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Your name was not saved. Check your connection and try again.",
    );
    await page.unroute("**/api/auth/update-user");
    await input.fill(`${renamed} pending`);
    let releaseSave!: () => void;
    const pendingSave = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    await page.route("**/api/auth/update-user", async (route) => {
      await pendingSave;
      await route.continue();
    });
    await dialog.getByRole("button", { name: "Save" }).click();
    try {
      await expect(
        dialog.getByRole("button", { name: "Saving…" }),
      ).toBeDisabled();
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeDisabled();
      await page.keyboard.press("Escape");
      await openAccountSettings();
      await expect(
        dialog.getByRole("button", { name: "Edit name" }),
      ).toBeDisabled();
    } finally {
      releaseSave();
    }
    await expect(
      dialog.getByRole("button", { name: "Edit name" }),
    ).toBeEnabled();
    await page.unroute("**/api/auth/update-user");
    await dialog.getByRole("button", { name: "Edit name" }).click();
    await dialog.getByRole("textbox", { name: "Name" }).fill(renamed);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Name saved.");
    await expect(dialog.getByRole("heading", { name: renamed })).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveCount(0);

    await page.keyboard.press("Escape");
    // openProfile's goto is the fresh load. A reload first would leave that page's
    // session check in flight; Firefox cancels it, admit reads that as signed out,
    // and its redirect to the door aborts the goto.
    const reopened = await openProfile();
    await expect(
      reopened.getByRole("heading", { name: renamed }),
    ).toBeVisible();
    const [stored] =
      await sql`select name from auth."user" where id = ${original.id}`;
    expect(stored.name).toBe(renamed);
    const audit =
      await sql`select actor_id from directory.auth_audit_event where type = 'user.profile.updated' and target_user_id = ${original.id}`;
    expect(audit.length).toBeGreaterThan(0);
    expect(audit[0].actor_id).toBe(original.id);
  } finally {
    await sql`update auth."user" set name = ${original.name} where id = ${original.id}`;
    await sql.close();
  }
});

test("remaining emergency reads retry and a stale open dialog requires reauthentication", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const sql = new SQL(databaseUrl);
  const [original] =
    await sql`select role from auth."user" where email = ${operator.email}`;
  const originalFactors =
    await sql`select * from auth.two_factor where user_id = (select id from auth."user" where email = ${operator.email})`;
  let session = (
    await (await page.request.get(`${coreOrigin}/api/auth/get-session`)).json()
  ).session;
  try {
    await sql`update auth."user" set two_factor_enabled = false where email = ${operator.email}`;
    const setup = await page.request.post(
      `${coreOrigin}/api/auth/two-factor/enable`,
      {
        headers: { origin: adminOrigin },
        data: { password: operator.password, method: "totp" },
      },
    );
    expect(setup.ok()).toBe(true);
    const { totpURI } = await setup.json();
    const verified = await page.request.post(
      `${coreOrigin}/api/auth/two-factor/verify-totp`,
      {
        headers: { origin: adminOrigin },
        data: { code: authenticatorCode(totpURI), trustDevice: false },
      },
    );
    expect(verified.ok()).toBe(true);
    session = (
      await (
        await page.request.get(`${coreOrigin}/api/auth/get-session`)
      ).json()
    ).session;
    await sql`update auth."user" set role = 'super-admin' where email = ${operator.email}`;
    const subsidiary = await page.request.post(
      `${coreOrigin}/api/auth-management/subsidiaries`,
      {
        headers: { origin: adminOrigin },
        data: { name: "QA stale dialog", slug: `stale-${crypto.randomUUID()}` },
      },
    );
    expect(subsidiary.status()).toBe(201);
    const organizationId = (await subsidiary.json()).data.id;
    await page.goto("/identity-access/privileged-access");
    await page.route("**/api/access-control/break-glass", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "QA unavailable" }),
      }),
    );
    await page
      .getByRole("button", { name: "Request emergency access" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Emergency access",
      exact: true,
    });
    await dialog
      .getByRole("combobox", { name: "Subsidiary", exact: true })
      .selectOption(organizationId);
    await dialog
      .getByRole("combobox", { name: "Scope", exact: true })
      .selectOption("subsidiary");
    await dialog
      .getByLabel("Reason", { exact: true })
      .fill("QA stale-session check");
    await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 20_000 });
    await expect(
      dialog.getByRole("button", { name: "Activate for 15 minutes" }),
    ).toBeDisabled();
    await page.unroute("**/api/access-control/break-glass");
    await expect(dialog.getByRole("alert")).toHaveCount(0, { timeout: 20_000 });
    await expect(
      dialog.getByRole("button", { name: "Activate for 15 minutes" }),
    ).toBeEnabled();
    await sql`update auth.session set created_at = now() - interval '16 minutes' where id = ${session.id}`;
    const activation = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/access-control/break-glass") &&
        response.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Activate for 15 minutes" })
      .click();
    expect((await activation).status()).toBe(403);
    await expect(page).toHaveURL(/\/reauth\?redirect=/);
    expect(new URL(page.url()).origin).toBe(E2E_ORIGINS.auth);
    await expect(
      page.getByRole("heading", { name: "Confirm it’s you" }),
    ).toBeVisible();
    const target = new URL(page.url()).searchParams.get("redirect");
    expect(target).toBe(`${adminOrigin}/identity-access/privileged-access`);
    const [count] =
      await sql`select count(*)::int as count from access_control.break_glass_elevation where session_id = ${session.id} and reason = 'QA stale-session check'`;
    expect(count.count).toBe(0);
    await page.getByLabel("Password", { exact: true }).fill(operator.password);
    await page
      .getByRole("button", { name: "Confirm and continue", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Verify it’s you" }),
    ).toBeVisible();
    await page
      .getByLabel("Authenticator code", { exact: true })
      .fill(authenticatorCode(totpURI));
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL(target!);
    await page
      .getByRole("button", { name: "Request emergency access" })
      .click();
    await dialog
      .getByRole("combobox", { name: "Subsidiary", exact: true })
      .selectOption(organizationId);
    await dialog
      .getByRole("combobox", { name: "Scope", exact: true })
      .selectOption("subsidiary");
    await dialog
      .getByLabel("Reason", { exact: true })
      .fill("QA confirmed-session check");
    const resumed = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/access-control/break-glass") &&
        response.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Activate for 15 minutes" })
      .click();
    expect((await resumed).ok()).toBe(true);
    const [grant] =
      await sql`select id from access_control.break_glass_elevation where reason = 'QA confirmed-session check' and user_id = (select id from auth."user" where email = ${operator.email}) order by activated_at desc limit 1`;
    expect(grant).toBeDefined();
    expect(
      (
        await page.request.delete(
          `${coreOrigin}/api/access-control/break-glass/${grant.id}`,
          { headers: { origin: adminOrigin } },
        )
      ).ok(),
    ).toBe(true);
  } finally {
    await sql`update access_control.break_glass_elevation set ended_at = now() where reason = 'QA confirmed-session check' and user_id = (select id from auth."user" where email = ${operator.email}) and ended_at is null`;
    await sql`update auth.session set created_at = ${new Date(session.createdAt)} where id = ${session.id}`;
    await sql`update auth."user" set role = ${original.role} where email = ${operator.email}`;
    await sql`delete from auth.two_factor where user_id = (select id from auth."user" where email = ${operator.email})`;
    if (originalFactors.length)
      await sql`insert into auth.two_factor ${sql(originalFactors)}`;
    await sql.close();
  }
});

test("remaining repeated SPA navigation keeps the session and reports browser heap usage", async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== "chromium" || isMobile,
    "Chromium desktop heap instrumentation",
  );
  test.setTimeout(120_000);
  await page.goto("/identity-access/people");
  await expect(page.locator("main h1")).toBeVisible();
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("HeapProfiler.collectGarbage");
  const before = await devtools.send("Runtime.getHeapUsage");
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  for (let index = 0; index < 30; index += 1) {
    const path =
      index % 2 ? "/identity-access/people" : "/identity-access/work-queue";
    await page.locator(`a[href="${path}"]`).first().click();
    await expect(page).toHaveURL(`${adminOrigin}${path}`);
    await expect(page.locator("main h1")).toBeVisible();
  }
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  const current = await page.request.get(`${coreOrigin}/api/auth/get-session`);
  expect(current.status()).toBe(200);
  expect((await current.json()).user.email).toBe(operator.email);
  await devtools.send("HeapProfiler.collectGarbage");
  const after = await devtools.send("Runtime.getHeapUsage");
  console.info(
    `QA SPA navigation: 30 transitions, heapBeforeMiB=${(before.usedSize / 1048576).toFixed(1)}, heapAfterMiB=${(after.usedSize / 1048576).toFixed(1)}, heapDeltaMiB=${((after.usedSize - before.usedSize) / 1048576).toFixed(1)}`,
  );
  await devtools.detach();
});

test("remaining identity role affordances match the operator permissions", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const sql = new SQL(databaseUrl);
  const [original] =
    await sql`select role from auth."user" where email = ${operator.email}`;
  const email = `affordances-${crypto.randomUUID()}@tagaroa.test`;
  let userId = "";
  try {
    await sql`update auth."user" set role = 'super-admin' where email = ${operator.email}`;
    const created = await page.request.post(
      `${coreOrigin}/api/auth/admin/create-user`,
      {
        headers: { origin: adminOrigin },
        data: {
          email,
          password: "QaAffordancePassword123!",
          name: "QA permission target",
          data: { personalEmail: `personal.${email}` },
        },
      },
    );
    expect(created.ok()).toBe(true);
    userId = (await created.json()).user.id;
    const subsidiary = await page.request.post(
      `${coreOrigin}/api/auth-management/subsidiaries`,
      {
        headers: { origin: adminOrigin },
        data: {
          name: "QA permission subsidiary",
          slug: `permissions-${crypto.randomUUID()}`,
        },
      },
    );
    expect(subsidiary.status()).toBe(201);
    const organizationId = (await subsidiary.json()).data.id;
    const team = await page.request.post(
      `${coreOrigin}/api/auth-management/subsidiaries/${organizationId}/teams`,
      {
        headers: { origin: adminOrigin },
        data: { name: "QA permission team" },
      },
    );
    expect(team.status()).toBe(201);
    const permissionTeamId = (await team.json()).data.id;
    const member = await page.request.post(
      `${coreOrigin}/api/auth-management/subsidiaries/${organizationId}/members`,
      {
        headers: { origin: adminOrigin },
        data: {
          organizationId,
          userId,
          role: "member",
          teamId: permissionTeamId,
        },
      },
    );
    expect(member.status()).toBe(201);
    for (const role of [
      "access-reviewer",
      "helpdesk",
      "admin",
      "super-admin",
    ]) {
      await sql`update auth."user" set role = ${role} where email = ${operator.email}`;
      await page.goto(`/subsidiaries?id=${organizationId}`);
      await expect(
        page.getByText("QA permission team", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(email, { exact: true })).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: `Remove ${email} from QA permission team`,
        }),
      ).toHaveCount(role === "admin" || role === "super-admin" ? 1 : 0);
      await expect(
        page.getByRole("combobox", {
          name: "Add someone to QA permission team",
        }),
      ).toHaveCount(role === "admin" || role === "super-admin" ? 1 : 0);
      await page.goto("/identity-access/people");
      await filterAccounts(page, email);
      await page
        .getByRole("button", { name: `Actions for ${email}`, exact: true })
        .click();
      const available = {
        "Edit account": role === "admin" || role === "super-admin",
        "Issue new password": role !== "access-reviewer",
        "Revoke all sessions": role !== "access-reviewer",
        "Suspend access": role === "admin" || role === "super-admin",
        Impersonate: role === "super-admin",
        "Delete account": role === "super-admin",
      };
      for (const [name, visible] of Object.entries(available)) {
        await expect(
          page.getByRole("menuitem", { name, exact: true }),
        ).toHaveCount(visible ? 1 : 0);
      }
      await page.keyboard.press("Escape");
      await page.goto("/identity-access/business-access/roles");
      await expect(page.locator("main h1")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Create role", exact: true }),
      ).toHaveCount(role === "super-admin" ? 1 : 0);
      await page.goto("/identity-access/privileged-access");
      await expect(page.locator("main h1")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Request emergency access" }),
      ).toHaveCount(role === "super-admin" ? 1 : 0);
    }
    await sql`update auth."user" set role = 'user' where email = ${operator.email}`;
    await page.goto("/identity-access/people");
    await expect(page).toHaveURL(`${E2E_ORIGINS.workspace}/`);
  } finally {
    await sql`update auth."user" set role = 'super-admin' where email = ${operator.email}`;
    if (userId)
      await page.request.post(`${coreOrigin}/api/auth/admin/remove-user`, {
        headers: { origin: adminOrigin },
        data: { userId },
      });
    await sql`update auth."user" set role = ${original.role} where email = ${operator.email}`;
    await sql.close();
  }
});

test("remaining identity role and position workflows persist through reload", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const browserErrors: string[] = [];
  const failedScripts: { path: string; error: string | undefined }[] = [];
  page.on("pageerror", (error) =>
    browserErrors.push(error.stack ?? error.message),
  );
  page.on("requestfailed", (request) => {
    if (request.resourceType() !== "script") return;
    const url = new URL(request.url());
    failedScripts.push({
      path: url.origin + url.pathname,
      error: request.failure()?.errorText,
    });
  });
  const sql = new SQL(databaseUrl);
  const [original] =
    await sql`select role from auth."user" where email = ${operator.email}`;
  let userId = "";
  try {
    await sql`update auth."user" set role = 'super-admin' where email = ${operator.email}`;
    const created = await page.request.post(
      `${coreOrigin}/api/auth/admin/create-user`,
      {
        headers: { origin: adminOrigin },
        data: {
          email: `roles-${crypto.randomUUID()}@tagaroa.test`,
          password: "QaRolePassword123!",
          name: "QA role person",
          data: { personalEmail: "qa-roles@tagaroa.test" },
        },
      },
    );
    expect(created.ok()).toBe(true);
    userId = (await created.json()).user.id;
    await sql`update auth."user" set must_change_password = false where id = ${userId}`;
    for (const [label, role] of [
      ["Helpdesk", "helpdesk"],
      ["Access reviewer", "access-reviewer"],
      ["Identity administrator", "admin"],
      ["Super administrator", "super-admin"],
      ["Employee", "user"],
    ]) {
      await page.goto(`/identity-access/people/${userId}`);
      await page
        .getByRole("button", { name: "Edit account", exact: true })
        .click();
      const edit = page.getByRole("dialog", { name: "Edit account" });
      await edit.getByRole("combobox", { name: "Role", exact: true }).click();
      await page.getByRole("option", { name: label, exact: true }).click();
      await edit
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(edit).toHaveCount(0);
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Edit account", exact: true }),
      ).toBeVisible();
      expect(
        (await sql`select role from auth."user" where id = ${userId}`)[0].role,
      ).toBe(role);
    }
    await page.getByRole("button", { name: "Add or edit position" }).click();
    const position = page.getByRole("dialog", { name: "Position & reporting" });
    await expect(
      position.getByRole("button", { name: "Save position" }),
    ).toBeDisabled();
    await position.getByLabel("Title", { exact: true }).fill("QA coordinator");
    await position.getByRole("button", { name: "Save position" }).click();
    await expect(position).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByText("QA coordinator", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add or edit position" }).click();
    await position.getByLabel("Title", { exact: true }).fill("QA lead");
    await position.getByRole("button", { name: "Save position" }).click();
    await expect(position).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("QA lead", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add or edit position" }).click();
    await position.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(position).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Edit account", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("QA lead", { exact: true })).toHaveCount(0);
  } finally {
    if (userId)
      await page.request.post(`${coreOrigin}/api/auth/admin/remove-user`, {
        headers: { origin: adminOrigin },
        data: { userId },
      });
    await sql`update auth."user" set role = ${original.role} where email = ${operator.email}`;
    await sql.close();
    await test.info().attach("role-reload-browser-diagnostics", {
      body: JSON.stringify({ browserErrors, failedScripts }, null, 2),
      contentType: "application/json",
    });
  }
  expect(browserErrors).toEqual([]);
});

test("remaining emergency access is visible and can be ended from another tab", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const sql = new SQL(databaseUrl);
  const [original] =
    await sql`select role from auth."user" where email = ${operator.email}`;
  let elevationId = "";
  try {
    await sql`update auth."user" set role = 'super-admin' where email = ${operator.email}`;
    const subsidiary = await page.request.post(
      `${coreOrigin}/api/auth-management/subsidiaries`,
      {
        headers: { origin: adminOrigin },
        data: { name: "QA cross-tab", slug: `tabs-${crypto.randomUUID()}` },
      },
    );
    expect(subsidiary.status()).toBe(201);
    const organizationId = (await subsidiary.json()).data.id;
    await page.goto("/identity-access/privileged-access");
    await page
      .getByRole("button", { name: "Request emergency access" })
      .click();
    const other = await context.newPage();
    await other.goto("/identity-access/privileged-access");
    await other.bringToFront();
    await other
      .getByRole("button", { name: "Request emergency access" })
      .click();
    const dialog = other.getByRole("dialog", {
      name: "Emergency access",
      exact: true,
    });
    await dialog
      .getByRole("combobox", { name: "Subsidiary", exact: true })
      .selectOption(organizationId);
    await dialog
      .getByRole("combobox", { name: "Scope", exact: true })
      .selectOption("subsidiary");
    await dialog
      .getByLabel("Reason", { exact: true })
      .fill("QA cross-tab recovery");
    const activated = other.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/access-control/break-glass"),
    );
    await dialog
      .getByRole("button", { name: "Activate for 15 minutes" })
      .click();
    const activation = await activated;
    expect(activation.status()).toBe(201);
    elevationId = (await activation.json()).data.id;
    await expect(
      dialog.getByText("Emergency access is active", { exact: true }),
    ).toBeVisible();
    await page.bringToFront();
    await expect(
      page.getByText("Emergency access is active", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("QA cross-tab recovery", { exact: true }),
    ).toBeVisible();
    await other.bringToFront();
    await settleAnimations(other);
    const accessibility = await new AxeBuilder({ page: other })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await other.getByRole("button", { name: "End emergency access" }).click();
    await expect(dialog).toHaveCount(0);
    await page.bringToFront();
    await expect(
      page.getByText("Emergency access is active", { exact: true }),
    ).toHaveCount(0);
    const effective = await page.request.get(
      `${coreOrigin}/api/access-control/me?organizationId=${organizationId}`,
    );
    expect(effective.status()).toBe(200);
    expect((await effective.json()).data.permissions).not.toContain(
      "domain:administer",
    );
    const renewed = await page.request.post(
      `${coreOrigin}/api/access-control/break-glass`,
      {
        headers: { origin: adminOrigin },
        data: {
          organizationId,
          permission: "domain:administer",
          scope: "subsidiary",
          reason: "QA expiry recovery",
        },
      },
    );
    expect(renewed.status()).toBe(201);
    elevationId = (await renewed.json()).data.id;
    await expect(
      page.getByText("Emergency access is active", { exact: true }),
    ).toBeVisible();
    await sql`update access_control.break_glass_elevation set expires_at = now() - interval '1 second' where id = ${elevationId}`;
    await expect(
      page.getByText("Emergency access is active", { exact: true }),
    ).toHaveCount(0);
    await other.close();
  } finally {
    if (elevationId)
      await sql`update access_control.break_glass_elevation set ended_at = now() where id = ${elevationId} and ended_at is null`;
    await sql`update auth."user" set role = ${original.role} where email = ${operator.email}`;
    await sql.close();
  }
});

test("delivery reads retry, filters survive reload and message details exclude credentials", async ({
  page,
}) => {
  test.setTimeout(90000);
  const sql = new SQL(databaseUrl);
  const id = crypto.randomUUID();
  const key = `qa.delivery.${id}`;
  const destination = `delivery-${id}@tagaroa.test`;
  try {
    await sql`insert into notification.message (id, key, channel, locale, destination, payload, secrets, status, attempts, error) values (${id}, ${key}, 'email', 'en', ${destination}, ${{ subject: "QA delivery subject", body: "QA rendered message", variables: [] }}::jsonb, ${{ temporaryPassword: "QA-HIDDEN-CREDENTIAL" }}::jsonb, 'failed', 3, 'QA permanent rejection')`;
    expect(
      (
        await sql`select payload->>'body' as body from notification.message where id = ${id}`
      )[0].body,
    ).toBe("QA rendered message");
    await page.route("**/api/notifications/messages?*", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "QA unavailable" }),
      }),
    );
    await page.goto("/notifications/delivery");
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await page.unroute("**/api/notifications/messages?*");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Search the message log" })
      .fill(destination);
    await expect(page).toHaveURL(
      new RegExp(`q=${destination.replace("@", "%40")}`),
    );
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Search the message log" }),
    ).toHaveValue(destination);
    await page
      // Desktop rows have a "View … to …" icon button; mobile rows are named by
      // their visible key, status and destination.
      .getByRole("button", {
        name: new RegExp(
          [key, destination]
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join(".*"),
        ),
      })
      .filter({ visible: true })
      .click();
    const detail = page.getByRole("dialog", { name: key, exact: true });
    await expect(detail).toContainText("QA rendered message");
    await expect(detail).toContainText("QA permanent rejection");
    await expect(detail).not.toContainText("QA-HIDDEN-CREDENTIAL");
    const response = await page.request.get(
      `${coreOrigin}/api/notifications/messages?q=${encodeURIComponent(destination)}`,
    );
    expect(response.ok()).toBe(true);
    expect(await response.text()).not.toContain("QA-HIDDEN-CREDENTIAL");
    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0);
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(
      page.getByRole("textbox", { name: "Search the message log" }),
    ).toHaveValue("");
  } finally {
    await sql`delete from notification.message where id = ${id}`;
    await sql.close();
  }
});

test("suppression search survives reload, cancellation and failed lifting before retry", async ({
  page,
}) => {
  const sql = new SQL(databaseUrl);
  const id = crypto.randomUUID();
  const destination = `suppression-${id}@tagaroa.test`;
  try {
    await sql`insert into notification.suppression (id, channel, destination, reason) values (${id}, 'email', ${destination}, 'manual')`;
    await page.goto("/notifications/suppressions");
    await page
      .getByRole("textbox", { name: "Search suppressed destinations" })
      .fill(destination);
    await expect(page).toHaveURL(
      new RegExp(`q=${destination.replace("@", "%40")}`),
    );
    await page.reload();
    const allow = page
      .getByRole("button", { name: "Allow again", exact: true })
      .filter({ visible: true });
    await expect(allow).toHaveCount(1);
    await allow.click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      (await sql`select id from notification.suppression where id = ${id}`)
        .length,
    ).toBe(1);
    await allow.click();
    const url = `**/api/notifications/suppressions/${id}`;
    await page.route(url, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "QA unavailable" }),
      }),
    );
    const failed = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/suppressions/${id}`) &&
        response.request().method() === "DELETE",
    );
    await page
      .getByRole("button", { name: "Lift suppression", exact: true })
      .click();
    expect((await failed).status()).toBe(503);
    await expect(
      page.getByRole("alertdialog", { name: "Lift this suppression?" }),
    ).toBeVisible();
    expect(
      (await sql`select id from notification.suppression where id = ${id}`)
        .length,
    ).toBe(1);
    await page.unroute(url);
    const lifted = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/suppressions/${id}`) &&
        response.request().method() === "DELETE",
    );
    await page
      .getByRole("button", { name: "Lift suppression", exact: true })
      .click();
    expect((await lifted).ok()).toBe(true);
    await expect(allow).toHaveCount(0);
    expect(
      (await sql`select id from notification.suppression where id = ${id}`)
        .length,
    ).toBe(0);
  } finally {
    await sql`delete from notification.suppression where id = ${id}`;
    await sql.close();
  }
});

test("subsidiary and team creation retain drafts after failure and persist after reload", async ({
  page,
}) => {
  const sql = new SQL(databaseUrl);
  const [original] =
    await sql`select role from auth."user" where email = ${operator.email}`;
  const name = `QA subsidiary ${crypto.randomUUID()}`;
  try {
    await sql`update auth."user" set role = 'super-admin' where email = ${operator.email}`;
    await page.goto("/subsidiaries");
    await page
      .getByRole("button", { name: "New subsidiary", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "New subsidiary",
      exact: true,
    });
    await dialog.getByLabel("Name", { exact: true }).fill(name);
    const slug = await dialog.getByLabel("Slug", { exact: true }).inputValue();
    await page.route("**/api/auth-management/subsidiaries", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "QA unavailable" }),
      }),
    );
    const failed = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth-management/subsidiaries") &&
        response.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Create subsidiary", exact: true })
      .click();
    expect((await failed).status()).toBe(503);
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(name);
    await page.unroute("**/api/auth-management/subsidiaries");
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth-management/subsidiaries") &&
        response.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Create subsidiary", exact: true })
      .click();
    const response = await created;
    expect(response.status()).toBe(201);
    const organizationId = (await response.json()).data.id;
    await page.goto(`/subsidiaries?id=${organizationId}`);
    await page.getByRole("button", { name: "New team", exact: true }).click();
    await page.getByLabel("Team name", { exact: true }).fill("QA no domain");
    await page
      .getByRole("button", { name: "Create team", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "New team", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("QA no domain", { exact: true })).toBeVisible();
    const [stored] =
      await sql`select name, slug from auth.organization where id = ${organizationId}`;
    expect(stored).toMatchObject({ name, slug });
  } finally {
    await sql`update auth."user" set role = ${original.role} where email = ${operator.email}`;
    await sql.close();
  }
});

test("membership, scoped assignment, emergency access, impersonation and deletion work through the UI", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const sql = new SQL(databaseUrl);
  const [original] =
    await sql`select role from auth."user" where email = ${operator.email}`;
  const email = `workflow-${crypto.randomUUID()}@tagaroa.test`;
  const headers = { origin: adminOrigin };
  try {
    await sql`update auth."user" set role = 'super-admin' where email = ${operator.email}`;
    const created = await page.request.post(
      `${coreOrigin}/api/auth/admin/create-user`,
      {
        data: {
          email,
          password: "WorkflowPassword123!",
          name: "QA workflow person",
          data: { personalEmail: `personal.${email}` },
        },
        headers,
      },
    );
    expect(created.ok()).toBe(true);
    const userId = (await created.json()).user.id;
    await sql`update auth."user" set must_change_password = false, two_factor_enabled = true where id = ${userId}`;
    const subsidiary = await page.request.post(
      `${coreOrigin}/api/auth-management/subsidiaries`,
      {
        data: {
          name: "QA workflow subsidiary",
          slug: `workflow-${crypto.randomUUID()}`,
        },
        headers,
      },
    );
    expect(subsidiary.status()).toBe(201);
    const organizationId = (await subsidiary.json()).data.id;
    const team = await page.request.post(
      `${coreOrigin}/api/auth-management/subsidiaries/${organizationId}/teams`,
      { data: { name: "Engineering" }, headers },
    );
    expect(team.status()).toBe(201);
    const teamId = (await team.json()).data.id;
    expect(
      (
        await page.request.put(
          `${coreOrigin}/api/access-control/teams/${teamId}/domain`,
          { data: { domainSlug: "engineering" }, headers },
        )
      ).ok(),
    ).toBe(true);
    await page.goto(`/subsidiaries?id=${organizationId}`);
    await page.route(
      `**/api/auth-management/subsidiaries/${organizationId}/members`,
      (route) =>
        route.fulfill({
          status: 503,
          json: { message: "QA membership unavailable" },
        }),
    );
    await page
      .getByRole("combobox", { name: "Add someone to Engineering" })
      .click();
    const failedAdd = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/subsidiaries/${organizationId}/members`) &&
        response.request().method() === "POST",
    );
    await page.getByRole("option", { name: email, exact: true }).click();
    expect((await failedAdd).status()).toBe(503);
    await expect(
      page.getByRole("button", { name: `Remove ${email} from Engineering` }),
    ).toHaveCount(0);
    expect(
      await sql`select id from auth.member where organization_id = ${organizationId} and user_id = ${userId}`,
    ).toHaveLength(0);
    await page.unroute(
      `**/api/auth-management/subsidiaries/${organizationId}/members`,
    );
    await page
      .getByRole("combobox", { name: "Add someone to Engineering" })
      .click();
    const membership = page.waitForResponse((response) =>
      response.url().endsWith(`/subsidiaries/${organizationId}/members`),
    );
    await page.getByRole("option", { name: email, exact: true }).click();
    expect((await membership).status()).toBe(201);
    await expect(
      page.getByRole("button", { name: `Remove ${email} from Engineering` }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: `Remove ${email} from Engineering` })
      .click();
    const removal = page.getByRole("alertdialog", {
      name: "Remove from Engineering?",
    });
    await removal.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByRole("button", { name: `Remove ${email} from Engineering` }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: `Remove ${email} from Engineering` })
      .click();
    await removal
      .getByRole("button", { name: "Remove from Engineering", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: `Remove ${email} from Engineering` }),
    ).toHaveCount(0);
    expect(
      (
        await sql`select id from auth.member where organization_id = ${organizationId} and user_id = ${userId}`
      ).length,
    ).toBe(1);
    await page.reload();
    await page
      .getByRole("combobox", { name: "Add someone to Engineering" })
      .click();
    const readded = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/organization/add-team-member"),
    );
    await page.getByRole("option", { name: email, exact: true }).click();
    expect((await readded).ok()).toBe(true);
    await expect(
      page.getByRole("button", { name: `Remove ${email} from Engineering` }),
    ).toBeVisible();

    await page.goto("/identity-access/business-access/assignments");
    await page
      .getByRole("button", { name: "Assign access", exact: true })
      .click();
    const assignment = page.getByRole("dialog", {
      name: "Assign business access",
    });
    await assignment
      .getByRole("combobox", { name: "Role", exact: true })
      .selectOption("system-domain-administrator");
    await assignment
      .getByRole("combobox", { name: "Subsidiary", exact: true })
      .selectOption(organizationId);
    await assignment
      .getByRole("combobox", { name: "Person", exact: true })
      .selectOption(userId);
    await assignment
      .getByRole("combobox", { name: "Scope", exact: true })
      .selectOption("team");
    await assignment
      .getByRole("combobox", { name: "Team", exact: true })
      .selectOption(teamId);
    await assignment
      .getByRole("button", { name: "Assign access", exact: true })
      .click();
    await expect(assignment).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Access assigned", exact: true }),
    ).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(
      page.getByRole("heading", { name: "Access assigned", exact: true }),
    ).toHaveCount(0, { timeout: 10_000 });
    const assignedRow = page.locator(".row-hover").filter({ hasText: email });
    await expect(
      assignedRow.getByText("Active", { exact: true }),
    ).toBeVisible();
    await assignedRow
      .getByRole("button", { name: "Revoke", exact: true })
      .click();
    await expect(
      assignedRow.getByRole("button", { name: "Revoke", exact: true }),
    ).toHaveCount(0);

    await page.goto("/identity-access/privileged-access");
    await page
      .getByRole("button", { name: "Request emergency access" })
      .click();
    const emergency = page.getByRole("dialog", {
      name: "Emergency access",
      exact: true,
    });
    await expect(
      emergency.getByRole("button", { name: "Activate for 15 minutes" }),
    ).toBeDisabled();
    await emergency
      .getByRole("combobox", { name: "Subsidiary", exact: true })
      .selectOption(organizationId);
    await emergency
      .getByRole("combobox", { name: "Scope", exact: true })
      .selectOption("team");
    await emergency
      .getByRole("combobox", { name: "Team", exact: true })
      .selectOption(teamId);
    await emergency
      .getByLabel("Reason", { exact: true })
      .fill("QA urgent access recovery");
    await emergency
      .getByRole("button", { name: "Activate for 15 minutes" })
      .click();
    await expect(
      emergency.getByText("Emergency access is active", { exact: true }),
    ).toBeVisible();
    await emergency
      .getByRole("button", { name: "End emergency access" })
      .click();
    await expect(emergency).toHaveCount(0);

    await page.goto("/identity-access/people");
    await filterAccounts(page, email);
    await page
      .getByRole("button", { name: `Actions for ${email}`, exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Impersonate", exact: true })
      .click();
    await page.getByRole("button", { name: "Start impersonating" }).click();
    await expect(page).toHaveURL(`${E2E_ORIGINS.workspace}/`);
    await expect(
      page.getByText("Impersonating", { exact: true }),
    ).toBeVisible();
    const returnedToWorkspace = page.waitForEvent("load");
    await page
      .getByRole("button", {
        name: "Stop impersonating and return to your account",
      })
      .click();
    await returnedToWorkspace;
    await expect(
      page.getByRole("heading", { name: "Home", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(`${E2E_ORIGINS.workspace}/`);
    await expect(page.getByText("Impersonating", { exact: true })).toHaveCount(
      0,
    );
    expect(
      (
        await (
          await page.request.get(`${coreOrigin}/api/auth/get-session`)
        ).json()
      ).user.email,
    ).toBe(operator.email);

    await page.goto(`/subsidiaries?id=${organizationId}`);
    await page
      .getByRole("button", { name: `Remove ${email} from Engineering` })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Remove from Engineering", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: `Remove ${email} from Engineering` }),
    ).toHaveCount(0);
    await page.goto("/identity-access/people");
    await filterAccounts(page, email);
    await page
      .getByRole("button", { name: `Actions for ${email}`, exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Delete account", exact: true })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete account", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: `Actions for ${email}`, exact: true }),
    ).toHaveCount(0);
    expect(
      (await sql`select id from auth."user" where id = ${userId}`).length,
    ).toBe(0);
  } finally {
    await sql`update auth."user" set role = ${original.role} where email = ${operator.email}`;
    await sql.close();
  }
});

test("a super administrator creates, edits and archives a business role with keyboard-accessible dialogs", async ({
  page,
}) => {
  const sql = new SQL(databaseUrl);
  const [original] =
    await sql`select role from auth."user" where email = ${operator.email}`;
  const name = `QA role ${crypto.randomUUID()}`;
  try {
    await sql`update auth."user" set role = 'super-admin' where email = ${operator.email}`;
    await page.goto("/identity-access/business-access/roles");
    const create = page.getByRole("button", {
      name: "Create role",
      exact: true,
    });
    await create.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Create a business role" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(create).toBeFocused();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Create a business role" });
    const saveRole = dialog.getByRole("button", { name: "Save role" });
    await expect(saveRole).toBeDisabled();
    await dialog.getByLabel("Name", { exact: true }).fill(name);
    await expect(dialog.getByLabel("Stable key")).toHaveValue(
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    );
    const key = `qa-custom-${crypto.randomUUID()}`;
    await dialog.getByLabel("Stable key").fill(key);
    await expect(saveRole).toBeDisabled();
    await dialog.getByLabel("Description").fill("QA explicit scoped access");
    await expect(saveRole).toBeDisabled();
    await dialog.getByRole("checkbox").first().check();
    await dialog.getByRole("checkbox").first().uncheck();
    await expect(saveRole).toBeDisabled();
    await dialog.getByRole("checkbox").first().check();
    await page.route("**/api/access-control/roles", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 503,
            json: { message: "QA role unavailable" },
          })
        : route.continue(),
    );
    const failedSave = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/access-control/roles"),
    );
    await saveRole.click();
    expect((await failedSave).status()).toBe(503);
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(name);
    await expect(dialog.getByLabel("Stable key")).toHaveValue(key);
    await expect(dialog.getByLabel("Description")).toHaveValue(
      "QA explicit scoped access",
    );
    await expect(dialog.getByRole("checkbox").first()).toBeChecked();
    await page.unroute("**/api/access-control/roles");
    // Axe would otherwise catch Save mid re-render at disabled opacity, or
    // mid-way through the 150ms opacity transition back from it.
    const save = dialog.getByRole("button", { name: "Save role" });
    await expect(save).toBeEnabled();
    await expect(save).toHaveCSS("opacity", "1");
    await expect(
      new AxeBuilder({ page })
        .include('[data-slot="dialog-content"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
        .then((result) =>
          result.violations.map(({ id, nodes }) => ({
            id,
            targets: nodes.map((node) => node.target),
          })),
        ),
    ).resolves.toEqual([]);
    await dialog.getByRole("button", { name: "Save role" }).click();
    await expect(dialog).toHaveCount(0);
    let row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Edit role" }).click();
    const edit = page.getByRole("dialog", { name: `Edit ${name}` });
    await expect(edit.getByLabel("Stable key")).toHaveCount(0);
    await expect(edit.getByLabel("Description")).toHaveValue(
      "QA explicit scoped access",
    );
    await expect(edit.getByRole("checkbox").first()).toBeChecked();
    await edit.getByLabel("Description").fill("QA revised description");
    await edit.getByLabel("Name", { exact: true }).fill(`${name} updated`);
    await edit.getByRole("button", { name: "Save role" }).click();
    await expect(edit).toHaveCount(0);
    await page.reload();
    row = page.getByRole("row").filter({ hasText: `${name} updated` });
    await expect(row).toBeVisible();
    await expect(row).toContainText("QA revised description");
    const [storedRole] =
      await sql`select id, key, description from access_control.access_role where key = ${key}`;
    expect(storedRole).toMatchObject({
      key,
      description: "QA revised description",
    });
    expect(
      Array.from(
        await sql`select permission from access_control.access_role_permission where role_id = ${storedRole.id}`,
      ),
    ).toEqual([{ permission: "domain:administer" }]);
    const archived = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        response.url().includes("/api/access-control/roles/"),
    );
    await row.getByRole("button", { name: "Archive", exact: true }).click();
    expect((await archived).ok()).toBe(true);
    await expect(row.getByText("Archived", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Edit role" })).toHaveCount(0);
  } finally {
    await sql`update auth."user" set role = ${original.role} where email = ${operator.email}`;
    await sql.close();
  }
});

test("administration pages pass accessibility checks in both themes and reflow on tablet and a zoom-equivalent viewport", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const paths = [
    "/identity-access/work-queue",
    "/identity-access/people",
    "/identity-access/business-access/assignments",
    "/identity-access/business-access/roles",
    "/identity-access/privileged-access",
    "/identity-access/reviews",
    "/identity-access/activity",
    "/notifications/overview",
    "/notifications/templates",
    "/notifications/delivery",
    "/notifications/suppressions",
    "/subsidiaries",
  ];
  await page.setViewportSize({ width: 768, height: 1024 });
  for (const theme of ["light", "dark"]) {
    await page.goto("/identity-access/work-queue", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("main h1")).toBeVisible();
    await page.evaluate(
      (theme) => localStorage.setItem("tagaroa-theme", theme),
      theme,
    );
    for (const path of paths) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main h1")).toBeVisible();
      await settleAnimations(page);
      const result = await new AxeBuilder({ page })
        .include('[data-slot="sidebar"], [data-slot="sidebar-inset"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        result.violations.map(({ id, nodes }) => ({
          id,
          nodes: nodes.map((node) => ({
            target: node.target,
            summary: node.failureSummary,
          })),
        })),
        `${theme} ${path}`,
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${theme} tablet ${path}`,
      ).toBe(true);
      await page.setViewportSize({ width: 384, height: 512 });
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${theme} double scale ${path}`,
      ).toBe(true);
      await page.setViewportSize({ width: 768, height: 1024 });
    }
  }
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("/identity-access/people");
  await expect(
    page.getByRole("textbox", { name: "Filter accounts" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Filter accounts" }).focus();
  await page.keyboard.type(E2E_ADMIN.email);
  await expect(
    page.getByRole("textbox", { name: "Filter accounts" }),
  ).toHaveValue(E2E_ADMIN.email);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("an operator can move from the work queue to a route-backed person", async ({
  page,
  isMobile,
}) => {
  await page.goto("/identity-access/work-queue");
  await expect(page.getByRole("heading", { name: "Work queue" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Identity & access", exact: true }),
  ).toBeVisible();

  if (isMobile) await page.locator('[data-slot="sidebar-trigger"]').click();
  await page.getByRole("link", { name: "People", exact: true }).click();
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await filterAccounts(page, operator.email);
  if (isMobile) {
    await page
      .getByRole("button", { name: `Actions for ${operator.email}` })
      .click();
    await page.getByRole("menuitem", { name: "View details" }).click();
  } else {
    await page
      .getByRole("link", { name: /E2E Admin/ })
      .first()
      .click();
  }

  await expect(page).toHaveURL(/\/identity-access\/people\/[^/?]+/);
  await expect(page.getByRole("heading", { name: "E2E Admin" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Access" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Sign-in" })).toBeVisible();

  await page
    .getByRole("navigation", { name: "breadcrumb" })
    .getByRole("link", { name: "People", exact: true })
    .click();
  await expect(page).toHaveURL(/\/identity-access\/people(?:\?.*)?$/);
});

test("all administration pages load without page errors or horizontal overflow", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of [
    "/identity-access/work-queue",
    "/identity-access/people",
    "/identity-access/business-access/assignments",
    "/identity-access/business-access/roles",
    "/identity-access/privileged-access",
    "/identity-access/reviews",
    "/identity-access/activity",
    "/notifications/overview",
    "/notifications/templates",
    "/notifications/delivery",
    "/notifications/suppressions",
    "/subsidiaries",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
    expect(errors, path).toEqual([]);
  }
});

test("an administrator issues, edits, suspends, restores and reissues an account", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const email = `qa-ui-${crypto.randomUUID()}@tagaroa.test`;
  await page.goto("/identity-access/people");
  await page.getByRole("button", { name: "Issue an account" }).click();
  await page.getByLabel("Work email", { exact: true }).fill(email);
  await page
    .getByLabel("Personal email", { exact: true })
    .fill(`personal-${email}`);
  await page.getByLabel("Name", { exact: true }).fill("QA lifecycle person");
  await page
    .getByRole("button", { name: "Issue account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Account issued" }),
  ).toBeVisible();
  const password = (
    await page.getByRole("dialog").locator("p.font-mono").innerText()
  ).trim();
  const employee = await browser.newContext();
  try {
    const headers = { origin: E2E_ORIGINS.admin };
    const signIn = () =>
      employee.request.post(`${coreOrigin}/api/auth/sign-in/email`, {
        headers,
        data: { email, password },
      });
    expect((await signIn()).ok()).toBe(true);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await filterAccounts(page, email);
    const actions = page.getByRole("button", { name: `Actions for ${email}` });
    await actions.click();
    await page
      .getByRole("menuitem", { name: "Edit account", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("QA revised person");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Edit account", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page
        .getByText("QA revised person", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await actions.click();
    await page
      .getByRole("menuitem", { name: "Suspend access", exact: true })
      .click();
    await page
      .getByLabel("Reason", { exact: true })
      .fill("QA lifecycle suspension");
    const suspended = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/admin/ban-user"),
    );
    await page
      .getByRole("button", { name: "Suspend access", exact: true })
      .click();
    expect((await suspended).ok()).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Suspend this person's access?" }),
    ).toHaveCount(0);
    expect((await signIn()).status()).toBe(403);
    await actions.click();
    await page
      .getByRole("menuitem", { name: "Restore access", exact: true })
      .click();
    const restored = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/admin/unban-user"),
    );
    await page
      .getByRole("button", { name: "Restore access", exact: true })
      .click();
    expect((await restored).ok()).toBe(true);
    await expect(
      page.getByRole("alertdialog", { name: "Restore access?" }),
    ).toHaveCount(0);
    expect((await signIn()).ok()).toBe(true);
    await actions.click();
    await page
      .getByRole("menuitem", { name: "Issue new password", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Issue new password", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "New password issued" }),
    ).toBeVisible();
    const replacement = (
      await page.getByRole("dialog").locator("p.font-mono").innerText()
    ).trim();
    expect(replacement === password).toBe(false);
    expect((await signIn()).status()).toBe(401);
    expect(
      (
        await employee.request.post(`${coreOrigin}/api/auth/sign-in/email`, {
          headers,
          data: { email, password: replacement },
        })
      ).ok(),
    ).toBe(true);
  } finally {
    await employee.close();
  }
});

test("operators see that their own privileged access needs another reviewer", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const sql = new SQL(databaseUrl);
  try {
    await sql`delete from directory.privileged_access_review where user_id in (select id from auth."user" where email = ${operator.email})`;
  } finally {
    await sql.close();
  }
  await page.goto("/identity-access/reviews");
  const own = page
    .getByRole("listitem")
    .filter({ has: page.getByText(operator.email, { exact: true }) });
  // The dashboard drains every page of accumulated fixtures before rendering.
  await expect(
    own.getByText("Needs another reviewer", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(own.getByRole("button", { name: "Confirm access" })).toHaveCount(
    0,
  );
});

test("business reviews, independent factor recovery and offboarding work through the UI", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const sql = new SQL(databaseUrl);
  const headers = { origin: adminOrigin };
  const [initial] =
    await sql`select role from auth."user" where email = ${operator.email}`;
  const suffix = crypto.randomUUID();
  const targetEmail = `security-target-${suffix}@tagaroa.test`;
  const reviewerEmail = `security-reviewer-${suffix}@tagaroa.test`;
  const password = "SecurityWorkflowPassword123!";
  let reviewerContext: BrowserContext | undefined;
  let organizationId: string | undefined;
  try {
    await sql`update auth."user" set role = 'super-admin' where email = ${operator.email}`;
    const issue = async (email: string) => {
      const response = await page.request.post(
        `${coreOrigin}/api/auth/admin/create-user`,
        {
          headers,
          data: {
            email,
            password,
            name: email,
            data: { personalEmail: `personal.${email}` },
          },
        },
      );
      expect(response.ok()).toBe(true);
      return (await response.json()).user.id as string;
    };
    const targetId = await issue(targetEmail);
    const reviewerId = await issue(reviewerEmail);
    await sql`update auth."user" set must_change_password = false, two_factor_enabled = true where id = ${targetId}`;
    await sql`update auth."user" set must_change_password = false, role = 'access-reviewer' where id = ${reviewerId}`;
    const subsidiary = await page.request.post(
      `${coreOrigin}/api/auth-management/subsidiaries`,
      {
        headers,
        data: { name: `Security ${suffix}`, slug: `security-${suffix}` },
      },
    );
    expect(subsidiary.ok()).toBe(true);
    organizationId = (await subsidiary.json()).data.id;
    expect(
      (
        await page.request.post(
          `${coreOrigin}/api/auth-management/subsidiaries/${organizationId}/members`,
          { headers, data: { userId: targetId } },
        )
      ).ok(),
    ).toBe(true);
    const assignment = await page.request.post(
      `${coreOrigin}/api/access-control/assignments`,
      {
        headers,
        data: {
          userId: targetId,
          organizationId,
          roleId: "system-domain-administrator",
          scope: "subsidiary",
        },
      },
    );
    expect(assignment.ok()).toBe(true);
    const teamName = `Delivery team ${suffix}`;
    const team = await page.request.post(
      `${coreOrigin}/api/auth-management/subsidiaries/${organizationId}/teams`,
      { headers, data: { name: teamName } },
    );
    expect(team.ok()).toBe(true);
    const teamId = (await team.json()).data.id;
    await page.goto(`/subsidiaries?id=${organizationId}`);
    const domainControl = page.getByRole("combobox", {
      name: `Domain for ${teamName}`,
      exact: true,
    });
    await domainControl.click();
    await page
      .getByRole("option", { name: "Engineering", exact: true })
      .click();
    await expect(domainControl).toContainText("Engineering");
    expect(
      (
        await sql`select domain_slug from access_control.team_domain where team_id = ${teamId}`
      )[0].domain_slug,
    ).toBe("engineering");
    await page
      .getByRole("combobox", {
        name: `Add someone to ${teamName}`,
        exact: true,
      })
      .click();
    await page.getByRole("option", { name: targetEmail, exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: `Remove ${targetEmail} from ${teamName}`,
        exact: true,
      }),
    ).toBeVisible();
    reviewerContext = await browser.newContext();
    expect(
      (
        await reviewerContext.request.post(
          `${coreOrigin}/api/auth/sign-in/email`,
          { headers, data: { email: reviewerEmail, password } },
        )
      ).ok(),
    ).toBe(true);
    await sql`update auth."user" set two_factor_enabled = true where id = ${reviewerId}`;
    const reviewerPage = await reviewerContext.newPage();
    await reviewerPage.goto(`${adminOrigin}/identity-access/reviews`);
    const assignmentRow = reviewerPage
      .getByRole("listitem")
      .filter({ hasText: targetEmail })
      .filter({ hasText: "Domain administrator" });
    await assignmentRow
      .getByRole("button", { name: "Review access", exact: true })
      .click();
    let dialog = reviewerPage.locator('[data-slot="dialog-content"]');
    await dialog
      .getByRole("textbox", { name: "Review evidence" })
      .fill("Manager verified responsibility in case UI-123");
    await dialog
      .getByRole("button", { name: "Record review", exact: true })
      .click();
    await expect(
      assignmentRow.getByText("Confirmed", { exact: true }),
    ).toBeVisible();
    await page.goto(`/identity-access/people/${targetId}`);
    await page
      .getByRole("button", { name: "Request factor recovery", exact: true })
      .click();
    dialog = page.locator('[data-slot="dialog-content"]');
    await dialog
      .getByRole("textbox", { name: "Reason and case reference" })
      .fill("Employee lost all factors; case UI-REC-123");
    await dialog
      .getByRole("textbox", { name: "Identity verification evidence" })
      .fill("Verified callback and manager confirmation in UI-REC-123");
    await dialog.getByRole("checkbox").check();
    await dialog
      .getByRole("button", { name: "Request recovery", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await sql`update auth."user" set role = 'super-admin' where id = ${reviewerId}`;
    await reviewerPage.goto(`${adminOrigin}/identity-access/reviews`);
    const recoveryRow = reviewerPage
      .getByRole("listitem")
      .filter({ hasText: targetEmail })
      .filter({ hasText: "Employee lost all factors" });
    await recoveryRow
      .getByRole("button", { name: "Verify and approve", exact: true })
      .click();
    dialog = reviewerPage.locator('[data-slot="dialog-content"]');
    await dialog
      .getByRole("textbox", { name: "Independent verification evidence" })
      .fill("Independent HR callback verified; case UI-REC-123");
    await dialog.getByRole("checkbox").check();
    await dialog
      .getByRole("button", { name: "Approve and replace factors", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", { name: "Factors replaced", exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    const [recovered] =
      await sql`select must_change_password, two_factor_enabled from auth."user" where id = ${targetId}`;
    expect(recovered.must_change_password).toBe(true);
    expect(recovered.two_factor_enabled).toBe(false);
    await page.reload();
    await page
      .getByRole("button", { name: "Offboard employee", exact: true })
      .click();
    dialog = page.locator('[data-slot="dialog-content"]');
    await dialog
      .getByRole("textbox", { name: "Reason and case reference" })
      .fill("HR authorized departure; case UI-OFF-123");
    await dialog
      .getByRole("button", { name: "Offboard employee", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    const [offboarded] =
      await sql`select banned, role from auth."user" where id = ${targetId}`;
    expect(offboarded.banned).toBe(true);
    expect(offboarded.role).toBe("user");
    expect(
      await sql`select id from auth.member where user_id = ${targetId}`,
    ).toHaveLength(0);
    expect(
      await sql`select id from auth.team_member where user_id = ${targetId}`,
    ).toHaveLength(0);
  } finally {
    await reviewerContext?.close();
    await sql`delete from auth."user" where email in (${targetEmail}, ${reviewerEmail})`;
    if (organizationId)
      await sql`delete from auth.organization where id = ${organizationId}`;
    await sql`update auth."user" set role = ${initial.role} where email = ${operator.email}`;
    await sql.close();
  }
});

test("directory renames persist, team deletion clears membership and subsidiary deletion is refused", async ({
  page,
}) => {
  const sql = new SQL(databaseUrl);
  const [original] =
    await sql`select role from auth."user" where email = ${operator.email}`;
  const headers = { origin: adminOrigin };
  const suffix = crypto.randomUUID();
  let organizationId: string | undefined;
  try {
    await sql`update auth."user" set role = 'super-admin' where email = ${operator.email}`;
    const created = await page.request.post(
      `${coreOrigin}/api/auth-management/subsidiaries`,
      {
        headers,
        data: { name: `Directory ${suffix}`, slug: `directory-${suffix}` },
      },
    );
    expect(created.status()).toBe(201);
    organizationId = (await created.json()).data.id;
    const createdTeam = await page.request.post(
      `${coreOrigin}/api/auth-management/subsidiaries/${organizationId}/teams`,
      {
        headers,
        data: { name: `Team ${suffix}` },
      },
    );
    expect(createdTeam.status()).toBe(201);
    const teamId = (await createdTeam.json()).data.id;
    expect(
      (
        await page.request.post(
          `${coreOrigin}/api/auth/organization/set-active`,
          { headers, data: { organizationId } },
        )
      ).ok(),
    ).toBe(true);
    expect(
      (
        await page.request.put(
          `${coreOrigin}/api/access-control/teams/${teamId}/domain`,
          { headers, data: { domainSlug: "engineering" } },
        )
      ).ok(),
    ).toBe(true);
    const [person] =
      await sql`select id from auth."user" where email = ${operator.email}`;
    expect(
      (
        await page.request.post(
          `${coreOrigin}/api/auth/organization/add-team-member`,
          { headers, data: { teamId, userId: person.id } },
        )
      ).ok(),
    ).toBe(true);
    // Rename/delete controls are absent; exercise the supported writes and read their result in the browser.
    expect(
      (
        await page.request.post(`${coreOrigin}/api/auth/organization/update`, {
          headers,
          data: {
            organizationId,
            data: { name: `Renamed subsidiary ${suffix}` },
          },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await page.request.post(
          `${coreOrigin}/api/auth/organization/update-team`,
          {
            headers,
            data: { teamId, data: { name: `Renamed team ${suffix}` } },
          },
        )
      ).ok(),
    ).toBe(true);
    await page.goto(`/subsidiaries?id=${organizationId}`);
    await expect(
      page.getByRole("heading", {
        name: `Renamed subsidiary ${suffix}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: `Renamed team ${suffix}`,
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("combobox", {
        name: `Domain for Renamed team ${suffix}`,
        exact: true,
      }),
    ).toContainText("Engineering");
    await expect(
      page.getByRole("button", {
        name: `Remove ${operator.email} from Renamed team ${suffix}`,
        exact: true,
      }),
    ).toBeVisible();
    const spare = await page.request.post(
      `${coreOrigin}/api/auth-management/subsidiaries/${organizationId}/teams`,
      { headers, data: { name: `Retained team ${suffix}` } },
    );
    expect(spare.status()).toBe(201);
    expect(
      (
        await page.request.post(
          `${coreOrigin}/api/auth/organization/remove-team`,
          { headers, data: { teamId, organizationId } },
        )
      ).ok(),
    ).toBe(true);
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: `Renamed team ${suffix}`,
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: `Retained team ${suffix}`,
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await sql`select id from auth.team_member where team_id = ${teamId}`,
    ).toHaveLength(0);
    expect(
      await sql`select team_id from access_control.team_domain where team_id = ${teamId}`,
    ).toHaveLength(0);
    const refused = await page.request.post(
      `${coreOrigin}/api/auth/organization/delete`,
      { headers, data: { organizationId } },
    );
    expect(refused.status()).toBe(403);
    expect((await refused.json()).code).toBe(
      "ORGANIZATION_WRITE_NOT_AVAILABLE",
    );
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: `Renamed subsidiary ${suffix}`,
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    if (organizationId)
      await sql`delete from auth.organization where id = ${organizationId}`;
    await sql`update auth."user" set role = ${original.role} where email = ${operator.email}`;
    await sql.close();
  }
});
