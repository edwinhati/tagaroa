import { expect, test } from "@playwright/test";
import {
  E2E_ADMIN,
  E2E_ORIGINS,
  TEST_DATABASE_URL,
} from "@repo/test-support/e2e-stack";
import { authenticatorCode } from "@repo/test-support/totp";
import { SQL } from "bun";

const coreServiceOrigin = E2E_ORIGINS.core;

// Seeded by `servers/core/test/e2e-admin.ts` before the core service starts.
const admin = E2E_ADMIN;

const browserDiagnostics = new WeakMap<
  object,
  Array<{ message: string; stack?: string }>
>();
test.beforeEach(async ({ page }, info) => {
  const errors: Array<{ message: string; stack?: string }> = [];
  browserDiagnostics.set(info, errors);
  page.on("requestfailed", (request) =>
    errors.push({
      message: `Request failed: ${request.url()}`,
      stack: request.failure()?.errorText,
    }),
  );
  page.on("pageerror", (error) =>
    errors.push({ message: error.message, stack: error.stack }),
  );
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      errors.push({
        message: message.text(),
        stack: JSON.stringify(message.location()),
      });
  });
});
test.afterEach(async ({ page }, info) => {
  await info.attach("browser-diagnostics", {
    body: JSON.stringify(
      { url: page.url(), events: browserDiagnostics.get(info) },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(
    browserDiagnostics
      .get(info)
      ?.filter(
        (event) =>
          event.stack?.includes("@tanstack_react-form.js") ||
          event.message.includes("Importing a module script failed."),
      ),
    "Sign-in must not leave an unhandled form or module-import error",
  ).toEqual([]);
});

test(
  "an issued operator replaces the temporary password and gets handed on",
  { lock: "e2e-admin" },
  async ({ page, request }) => {
    const email = `e2e-${crypto.randomUUID()}@tagaroa.test`;
    const temporaryPassword = "temporary-password-12";
    const chosenPassword = "chosen-password-12";
    const headers = { origin: E2E_ORIGINS.auth };

    // This fixture exercises account issuance, not authenticator enrollment.
    const sql = new SQL(TEST_DATABASE_URL);
    await sql`
    UPDATE "auth"."user" SET "two_factor_enabled" = false
    WHERE "email" = ${admin.email}
  `;
    const signedIn = await request.post(
      `${coreServiceOrigin}/api/auth/sign-in/email`,
      { data: admin, headers },
    );
    expect(signedIn.ok()).toBe(true);
    await sql`
    UPDATE "auth"."user"
    SET "two_factor_enabled" = true
    WHERE "email" = ${admin.email}
  `;
    await sql.close();

    const created = await request.post(
      `${coreServiceOrigin}/api/auth/admin/create-user`,
      {
        data: {
          data: {
            personalEmail: `personal-${crypto.randomUUID()}@tagaroa.test`,
          },
          email,
          name: "Browser Operator",
          password: temporaryPassword,
        },
        headers,
      },
    );
    expect(created.ok(), await created.text()).toBe(true);

    await page.goto("/?redirect=/locked-out");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(temporaryPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // The password an admin issued is replaced before the workspace is reachable,
    // and this page saw it typed, so it does not ask for it again.
    await expect(
      page.getByRole("heading", { name: "Choose your password" }),
    ).toBeFocused();
    await page.getByLabel("New password", { exact: true }).fill(chosenPassword);
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill(chosenPassword);
    await page.getByRole("button", { name: "Save and continue" }).click();

    await expect(page).toHaveURL(/\/locked-out$/);
    await expect(
      page.getByRole("heading", { name: "Forgot your password?" }),
    ).toBeVisible();
  },
);

test("the sign-in form focuses errors and keeps password reveal in place", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );

  const password = page.getByLabel("Password", { exact: true });
  await password.fill("example-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toBeFocused();
  await expect(password).toHaveAttribute("type", "text");

  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toBeFocused();
  await expect(password).toHaveAttribute("type", "password");
});

test("failed and unreachable sign-in requests allow retry without losing input", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Email").fill("missing@tagaroa.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password-12");
  await page.route("**/api/auth/sign-in/email", (route) =>
    route.abort("failed"),
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("missing@tagaroa.test");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/api/auth/sign-in/email");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/Invalid|incorrect/i);
});

test("offline and hung sign-in requests recover without losing credentials", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.getByLabel("Email").fill("missing@tagaroa.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password-12");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await context.setOffline(false);
  await page.route("**/api/auth/sign-in/email", () => {});
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Signing in…", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Email")).toHaveValue("missing@tagaroa.test");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "wrong-password-12",
  );
  await page.unroute("**/api/auth/sign-in/email");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/Invalid|incorrect/i);
});

test("locked-out reasons and narrow layouts keep sign-in reachable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 640 });
  for (const [reason, heading] of [
    ["expired", "Temporary password expired"],
    ["suspended", "Access suspended"],
    ["invalid", "Forgot your password?"],
  ] as const) {
    await page.goto(`/locked-out?reason=${reason}`);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "Back to sign in" }).click();
    await expect(page.getByLabel("Email")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test(
  "signing in replaces a revoked session cookie",
  { lock: "e2e-admin" },
  async ({ page, context }) => {
    const sql = new SQL(TEST_DATABASE_URL);
    await sql`
    UPDATE "auth"."user" SET "two_factor_enabled" = false
    WHERE "email" = ${admin.email}
  `;
    await sql.close();
    const headers = { origin: E2E_ORIGINS.auth };
    const signedIn = await page.request.post("/api/auth/sign-in/email", {
      data: admin,
      headers,
    });
    expect(signedIn.ok()).toBe(true);
    const cookies = await context.cookies();
    const revokedCookie = cookies.find(
      (cookie) => cookie.name === "better-auth.session_token",
    );
    expect(revokedCookie).toBeDefined();
    expect(
      (
        await page.request.post("/api/auth/sign-out", { data: {}, headers })
      ).ok(),
    ).toBe(true);
    await context.addCookies([revokedCookie!]);
    // Sign in without first visiting a route that can clear the stale cookie.
    const again = await page.request.post("/api/auth/sign-in/email", {
      data: admin,
      headers,
    });
    expect(again.ok()).toBe(true);
    const session = await page.request.get("/api/auth/get-session");
    expect((await session.json())?.user.email).toBe(admin.email);
  },
);

test(
  "authenticator enrollment, recovery codes, trusted devices, and passkeys work",
  { lock: "e2e-admin" },
  async ({ page, context, browserName, isMobile, browser }) => {
    // Enrollment, recovery, trusted devices, passkeys and reauth in one test:
    // ~55s of ~1s steps in WebKit on a CI-sized Linux machine.
    test.setTimeout(120_000);
    const sql = new SQL(TEST_DATABASE_URL);
    // Clear the issuance fixture's synthetic flag; enrollment goes through the UI.
    await sql`
    DELETE FROM "auth"."two_factor"
    WHERE "user_id" IN (SELECT "id" FROM "auth"."user" WHERE "email" = ${admin.email})
  `;
    await sql`
    UPDATE "auth"."user" SET "two_factor_enabled" = false
    WHERE "email" = ${admin.email}
  `;
    await sql.close();

    async function signIn(destination = "/locked-out") {
      await page.goto(`/?redirect=${encodeURIComponent(destination)}`);
      await page.getByLabel("Email", { exact: true }).fill(admin.email);
      await page.getByLabel("Password", { exact: true }).fill(admin.password);
      const response = page.waitForResponse((response) =>
        response.url().endsWith("/api/auth/sign-in/email"),
      );
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      expect((await response).ok()).toBe(true);
    }

    async function openAccountMenu() {
      const menu = page.getByRole("button", {
        name: `Account menu for ${admin.email.charAt(0).toUpperCase()} ${admin.email}`,
      });
      await expect(
        page.getByRole("heading", { name: "Home", exact: true }),
      ).toBeVisible();
      if (isMobile) await page.locator('[data-slot="sidebar-trigger"]').click();
      await menu.click();
    }

    async function signOut() {
      await expect(
        page.getByRole("heading", { name: "Forgot your password?" }),
      ).toBeVisible();
      expect(
        await page.evaluate(async () => {
          const response = await fetch("/api/auth/sign-out", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          });
          return response.ok;
        }),
      ).toBe(true);
      await expect
        .poll(() =>
          context
            .cookies()
            .then((cookies) =>
              cookies.some(
                (cookie) => cookie.name === "better-auth.session_token",
              ),
            ),
        )
        .toBe(false);
    }

    await signIn();
    await expect(
      page.getByRole("heading", { name: "Secure your account" }),
    ).toBeVisible();
    await page
      .getByLabel("Current password", { exact: true })
      .fill("wrong-password");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Invalid password");
    await page
      .getByLabel("Current password", { exact: true })
      .fill(admin.password);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("img", { name: "Authenticator setup QR code" }),
    ).toBeVisible();
    const abandonedUri = await page
      .getByRole("button", { name: "Open authenticator app" })
      .getAttribute("href");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Secure your account" }),
    ).toBeVisible();
    await page
      .getByLabel("Current password", { exact: true })
      .fill(admin.password);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("img", { name: "Authenticator setup QR code" }),
    ).toBeVisible();
    const uri = await page
      .getByRole("button", { name: "Open authenticator app" })
      .getAttribute("href");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).not.toBe(abandonedUri);
    await page.getByRole("button", { name: "Can’t scan the code?" }).click();
    await expect(page.getByText("Enter this setup key")).toBeVisible();
    await page.getByLabel("6-digit code", { exact: true }).fill("000000");
    await page
      .getByRole("button", { name: "Verify code", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Invalid code");
    const code = authenticatorCode(uri!);
    await expect(
      page.getByRole("button", { name: "Verify code", exact: true }),
    ).toBeEnabled();
    await page.getByLabel("6-digit code", { exact: true }).fill("");
    await page.getByLabel("6-digit code", { exact: true }).fill(code);
    await expect(page.getByLabel("6-digit code", { exact: true })).toHaveValue(
      code,
    );
    await page
      .getByRole("button", { name: "Verify code", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Save your recovery codes" }),
    ).toBeVisible();
    const codes = (await page.locator("pre").innerText()).trim().split(/\s+/);
    expect(codes).toHaveLength(10);
    await expect(
      page.getByRole("button", { name: "Continue to workspace" }),
    ).toBeDisabled();
    await page.reload();
    await expect(page).toHaveURL(/\/locked-out$/);
    const enrolled = await page.request.get(
      `${coreServiceOrigin}/api/auth/get-session`,
    );
    expect((await enrolled.json()).user.twoFactorEnabled).toBe(true);

    await signOut();
    await signIn();
    await expect(
      page.getByRole("heading", { name: "Verify it’s you" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Use a recovery code" }).click();
    await page
      .getByLabel("Recovery code", { exact: true })
      .fill("invalid-code");
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Invalid backup code");
    await page.getByLabel("Recovery code", { exact: true }).fill(codes[0]!);
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL(/\/locked-out$/);

    await signOut();
    await signIn();
    await page.getByRole("button", { name: "Use a recovery code" }).click();
    await page.getByLabel("Recovery code", { exact: true }).fill(codes[0]!);
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Invalid backup code");
    await page.getByRole("button", { name: "Use authenticator code" }).click();
    await page
      .getByLabel("Authenticator code", { exact: true })
      .fill(authenticatorCode(uri!, Date.now() - 300_000));
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Invalid code");
    await expect(
      page.getByRole("button", { name: "Verify", exact: true }),
    ).toBeEnabled();
    await page.getByLabel("Authenticator code", { exact: true }).fill("");
    await page
      .getByLabel("Authenticator code", { exact: true })
      .fill(authenticatorCode(uri!));
    await page
      .getByText("Trust this device for 30 days", { exact: true })
      .click();
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL(/\/locked-out$/);

    await signOut();
    await signIn(`${E2E_ORIGINS.workspace}/`);
    await expect(page).toHaveURL(`${E2E_ORIGINS.workspace}/`);
    await openAccountMenu();
    await expect(
      page.getByRole("menuitem", { name: "Account settings" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    expect(
      (
        await page.request.post(`${coreServiceOrigin}/api/auth/sign-out`, {
          data: {},
          headers: { origin: E2E_ORIGINS.workspace },
        })
      ).ok(),
    ).toBe(true);
    const expirySql = new SQL(TEST_DATABASE_URL);
    try {
      await expirySql`
      update auth.verification set expires_at = now() - interval '1 second'
      where identifier like 'trust-device-%'
      and value = (select id from auth."user" where email = ${admin.email})
    `;
      await signIn(`${E2E_ORIGINS.workspace}/`);
      await expect(
        page.getByRole("heading", { name: "Verify it’s you" }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Sign in to Tagaroa" }),
      ).toBeVisible();
      await signIn(`${E2E_ORIGINS.workspace}/`);
      await expect(
        page.getByRole("heading", { name: "Verify it’s you" }),
      ).toBeVisible();
      await expirySql`
      update auth.verification set expires_at = now() - interval '1 second'
      where value = (select id from auth."user" where email = ${admin.email})
      and identifier not like 'trust-device-%'
    `;
      await page
        .getByLabel("Authenticator code", { exact: true })
        .fill(authenticatorCode(uri!));
      await page.getByRole("button", { name: "Verify", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText(
        "This verification is no longer valid. Sign in again.",
      );
      await page
        .getByRole("button", { name: "Sign in again", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Sign in to Tagaroa" }),
      ).toBeVisible();
      expect(new URL(page.url()).searchParams.get("redirect")).toBe(
        `${E2E_ORIGINS.workspace}/`,
      );
      await page.getByLabel("Email", { exact: true }).fill(admin.email);
      await page.getByLabel("Password", { exact: true }).fill(admin.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Verify it’s you" }),
      ).toBeVisible();
      await page
        .getByLabel("Authenticator code", { exact: true })
        .fill(authenticatorCode(uri!));
      await page.getByRole("button", { name: "Verify", exact: true }).click();
      await expect(page).toHaveURL(`${E2E_ORIGINS.workspace}/`);
    } finally {
      await expirySql.close();
    }

    const handoffSession = await page.request.get(
      `${coreServiceOrigin}/api/auth/get-session`,
    );
    expect((await handoffSession.json())?.user.twoFactorEnabled).toBe(true);
    await openAccountMenu();
    await page.getByRole("menuitem", { name: "Account settings" }).click();
    await page.getByRole("tab", { name: "Security", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Recovery codes", exact: true }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Recovery codes", exact: true })
      .click();
    await page
      .getByLabel("Current password", { exact: true })
      .fill("wrong-password");
    await page
      .getByRole("button", { name: "Replace recovery codes", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Invalid password");
    await page
      .getByLabel("Current password", { exact: true })
      .fill(admin.password);
    await page
      .getByRole("button", { name: "Replace recovery codes", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Save your new recovery codes" }),
    ).toBeVisible();
    const replacementCodes = (await page.locator("pre").innerText())
      .trim()
      .split(/\s+/);
    expect(replacementCodes).toHaveLength(10);
    await expect(
      page.getByRole("button", { name: "Back to security", exact: true }),
    ).toBeDisabled();
    await page
      .getByText("I saved these recovery codes.", { exact: true })
      .click();
    await page
      .getByRole("button", { name: "Back to security", exact: true })
      .click();
    const challengeContext = await browser.newContext();
    try {
      const headers = { origin: E2E_ORIGINS.auth };
      const signed = await challengeContext.request.post(
        `${coreServiceOrigin}/api/auth/sign-in/email`,
        { data: admin, headers },
      );
      expect((await signed.json()).twoFactorRedirect).toBe(true);
      const oldCode = await challengeContext.request.post(
        `${coreServiceOrigin}/api/auth/two-factor/verify-backup-code`,
        { data: { code: codes[1] }, headers },
      );
      expect(oldCode.ok()).toBe(false);
      const newCode = await challengeContext.request.post(
        `${coreServiceOrigin}/api/auth/two-factor/verify-backup-code`,
        { data: { code: replacementCodes[0] }, headers },
      );
      expect(newCode.ok()).toBe(true);
      expect(
        (
          await challengeContext.request.post(
            `${coreServiceOrigin}/api/auth/sign-out`,
            { data: {}, headers },
          )
        ).ok(),
      ).toBe(true);
      for (const code of replacementCodes.slice(1)) {
        const challenge = await challengeContext.request.post(
          `${coreServiceOrigin}/api/auth/sign-in/email`,
          { data: admin, headers },
        );
        expect((await challenge.json()).twoFactorRedirect).toBe(true);
        const verified = await challengeContext.request.post(
          `${coreServiceOrigin}/api/auth/two-factor/verify-backup-code`,
          { data: { code }, headers },
        );
        expect(verified.ok()).toBe(true);
        expect(
          (
            await challengeContext.request.post(
              `${coreServiceOrigin}/api/auth/sign-out`,
              { data: {}, headers },
            )
          ).ok(),
        ).toBe(true);
      }
      const exhaustedChallenge = await challengeContext.request.post(
        `${coreServiceOrigin}/api/auth/sign-in/email`,
        { data: admin, headers },
      );
      expect((await exhaustedChallenge.json()).twoFactorRedirect).toBe(true);
      for (const code of replacementCodes) {
        const reused = await challengeContext.request.post(
          `${coreServiceOrigin}/api/auth/two-factor/verify-backup-code`,
          { data: { code }, headers },
        );
        expect(reused.ok()).toBe(false);
      }
      const freshChallenge = await challengeContext.request.post(
        `${coreServiceOrigin}/api/auth/sign-in/email`,
        { data: admin, headers },
      );
      expect((await freshChallenge.json()).twoFactorRedirect).toBe(true);
      const recovered = await challengeContext.request.post(
        `${coreServiceOrigin}/api/auth/two-factor/verify-totp`,
        { data: { code: authenticatorCode(uri!) }, headers },
      );
      expect(recovered.ok()).toBe(true);
    } finally {
      await challengeContext.close();
    }

    await page.goto(
      `${E2E_ORIGINS.auth}/reauth?redirect=http%3A%2F%2Flocalhost%3A13002%2F`,
    );
    await expect(
      page.getByRole("heading", { name: "Confirm it’s you" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
      "readonly",
      "",
    );
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Confirm and continue" }).click();
    await expect(page.getByRole("alert")).toContainText(/Invalid|incorrect/i);
    await page.getByLabel("Password", { exact: true }).fill(admin.password);
    await page.getByRole("button", { name: "Confirm and continue" }).click();
    await expect(
      page.getByRole("heading", { name: "Verify it’s you" }),
    ).toBeVisible();
    await page
      .getByLabel("Authenticator code", { exact: true })
      .fill(authenticatorCode(uri!));
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL(`${E2E_ORIGINS.workspace}/`);
    await openAccountMenu();
    await page.getByRole("menuitem", { name: "Account settings" }).click();
    await page.getByRole("tab", { name: "Security", exact: true }).click();

    // The virtual authenticator uses Chromium's DevTools protocol.
    if (browserName !== "chromium") return;

    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    const { authenticatorId } = await cdp.send(
      "WebAuthn.addVirtualAuthenticator",
      {
        options: {
          protocol: "ctap2",
          transport: "internal",
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      },
    );
    try {
      await page.getByLabel("New passkey name").fill("QA virtual device");
      await page.evaluate(() => {
        Object.defineProperty(navigator.credentials, "create", {
          configurable: true,
          value: () =>
            Promise.reject(
              new DOMException("Device prompt timed out", "NotAllowedError"),
            ),
        });
      });
      await page
        .getByRole("button", { name: "Add passkey", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText(
        "Passkey setup was canceled or timed out.",
      );
      await page.evaluate(() =>
        Reflect.deleteProperty(navigator.credentials, "create"),
      );
      await page
        .getByRole("button", { name: "Add passkey", exact: true })
        .click();
      await expect(
        page.getByText("Passkey added.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("QA virtual device", { exact: true }),
      ).toBeVisible();
      await page.getByRole("tab", { name: "Security", exact: true }).focus();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await openAccountMenu();
      await page
        .getByRole("menuitem", { name: "Sign out", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Sign in with a passkey" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Sign in with a passkey" })
        .click();
      await expect(page).toHaveURL(`${E2E_ORIGINS.workspace}/`);
      await openAccountMenu();
      await page.getByRole("menuitem", { name: "Account settings" }).click();
      await page.getByRole("tab", { name: "Security", exact: true }).click();
      await page
        .getByRole("button", { name: "Remove QA virtual device" })
        .click();
      await page
        .getByRole("button", { name: "Remove passkey", exact: true })
        .click();
      await expect(
        page.getByText("Passkey removed.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("QA virtual device", { exact: true }),
      ).toHaveCount(0);
    } finally {
      await cdp.send("WebAuthn.removeVirtualAuthenticator", {
        authenticatorId,
      });
      await cdp.detach();
    }
  },
);
