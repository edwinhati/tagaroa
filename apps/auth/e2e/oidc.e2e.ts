import { expect, test } from "@playwright/test";
import {
  E2E_ADMIN,
  E2E_ORIGINS,
  TEST_DATABASE_URL,
} from "@repo/test-support/e2e-stack";
import { SQL } from "bun";

const core = E2E_ORIGINS.core;
const callback = "https://vpn.example/oauth2/callback";
const loggedOut = "https://vpn.example/oauth2/logout/callback";

// NetBird's login (Dex) asks core to sign someone in, core sends them to the
// door, and the door hands them back once they are fully signed in: here a new
// employee still on the password an admin issued, with the consent prompt Dex
// sends when it wants a refresh token.
test(
  "another app signs a new employee in through the door",
  { lock: "e2e-admin" },
  async ({ page, request }) => {
    const email = `oidc-${crypto.randomUUID()}@tagaroa.test`;
    const temporaryPassword = "temporary-password-12";
    const headers = { origin: E2E_ORIGINS.auth };
    const clientId = `netbird-${crypto.randomUUID()}`;

    const sql = new SQL(TEST_DATABASE_URL);
    try {
      // Operators register clients with scripts/oauth-client.ts; the row is
      // what it leaves behind. The browser never needs the secret.
      await sql`
        INSERT INTO "auth"."oauth_client" (
          "id", "client_id", "client_secret", "name", "redirect_uris",
          "scopes", "grant_types", "response_types",
          "token_endpoint_auth_method", "skip_consent", "require_pkce",
          "enable_end_session", "post_logout_redirect_uris",
          "created_at", "updated_at"
        ) VALUES (
          ${crypto.randomUUID()}, ${clientId}, 'unused', 'NetBird',
          ARRAY[${callback}], ARRAY['openid', 'profile', 'email', 'offline_access'],
          ARRAY['authorization_code', 'refresh_token'], ARRAY['code'],
          'client_secret_basic', true, false, true, ARRAY[${loggedOut}],
          now(), now()
        )`;
      await sql`
        UPDATE "auth"."user" SET "two_factor_enabled" = false
        WHERE "email" = ${E2E_ADMIN.email}`;
      expect(
        (
          await request.post(`${core}/api/auth/sign-in/email`, {
            data: E2E_ADMIN,
            headers,
          })
        ).ok(),
      ).toBe(true);
      await sql`
        UPDATE "auth"."user" SET "two_factor_enabled" = true
        WHERE "email" = ${E2E_ADMIN.email}`;
    } finally {
      await sql.close();
    }
    const created = await request.post(`${core}/api/auth/admin/create-user`, {
      data: {
        data: { personalEmail: `personal-${crypto.randomUUID()}@tagaroa.test` },
        email,
        name: "Network User",
        password: temporaryPassword,
      },
      headers,
    });
    expect(created.ok(), await created.text()).toBe(true);
    await request.post(`${core}/api/auth/sign-out`, { headers });

    await page.route(/^https:\/\/vpn\.example\//, (route) =>
      route.fulfill({
        body: "<title>NetBird</title>",
        contentType: "text/html",
      }),
    );
    await page.goto(
      `${core}/api/auth/oauth2/authorize?${new URLSearchParams({
        // What Dex sends when NetBird asks it for a refresh token.
        access_type: "offline",
        client_id: clientId,
        prompt: "consent",
        redirect_uri: callback,
        response_type: "code",
        scope: "openid profile email",
        state: "from-netbird",
      })}`,
    );

    await expect(
      page.getByRole("heading", { name: "Sign in to Tagaroa" }),
    ).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(temporaryPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Onboarding comes first: the app hears nothing until it is done.
    await expect(
      page.getByRole("heading", { name: "Choose your password" }),
    ).toBeFocused();
    await page.getByLabel("New password", { exact: true }).fill("chosen-12345");
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("chosen-12345");
    await page.getByRole("button", { name: "Save and continue" }).click();

    await expect(page).toHaveURL(
      new RegExp(`^${callback}\\?code=[^&]+&state=from-netbird`),
    );

    // Signing out of NetBird: Dex sends no id_token_hint, so core cannot tie the
    // request to this session and the door asks, then hands the person back.
    await page.goto(
      `${core}/api/auth/oauth2/end-session?${new URLSearchParams({
        client_id: clientId,
        post_logout_redirect_uri: loggedOut,
        state: "leaving",
      })}`,
    );
    await expect(
      page.getByRole("heading", { name: "Sign out of Tagaroa" }),
    ).toBeFocused();
    await expect(page.getByText("NetBird is signing you out")).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(`${loggedOut}?state=leaving`);
    const session = await page.request.get(`${core}/api/auth/get-session`, {
      headers: { origin: E2E_ORIGINS.auth },
    });
    expect(await session.json()).toBeNull();
  },
);
