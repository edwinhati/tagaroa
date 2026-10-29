import { test } from "@e2e-dev/web";
import { expect } from "e2e";

import { authenticatorCode } from "../../servers/core/test/totp";

test.setup(
  "authenticate the isolated QA operator",
  { sessions: ["operator"] },
  async ({ app, browser, session, screen }) => {
    await app.open("http://localhost:13001/locked-out");
    const cookies = new Map<string, string>();
    const post = async (path: string, data: object) => {
      const response = await fetch(`http://localhost:18080/api/auth/${path}`, {
        method: "POST",
        headers: {
          origin: "http://localhost:13003",
          "content-type": "application/json",
          cookie: [...cookies]
            .map(([name, value]) => `${name}=${value}`)
            .join("; "),
        },
        body: JSON.stringify(data),
      });
      expect(response.ok).toBe(true);
      for (const header of response.headers.getSetCookie()) {
        const pair = header.split(";", 1)[0]!;
        const separator = pair.indexOf("=");
        cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
      return response.json();
    };
    const password = "e2e-admin-password-12";
    const signedIn = await post("sign-in/email", {
      email: "e2e-admin@tagaroa.test",
      password,
    });
    if (signedIn.twoFactorRedirect)
      throw new Error(
        "Exploration fixture must start without MFA; do not run alongside Playwright.",
      );
    const { totpURI } = await post("two-factor/enable", {
      password,
      method: "totp",
    });
    await post("two-factor/verify-totp", {
      code: authenticatorCode(totpURI),
      trustDevice: false,
    });
    const confirmed = await fetch(
      "http://localhost:18080/api/auth/get-session",
      {
        headers: {
          cookie: [...cookies]
            .map(([name, value]) => `${name}=${value}`)
            .join("; "),
        },
      },
    );
    expect(Boolean((await confirmed.json())?.user)).toBe(true);
    await browser.setCookies(
      [...cookies].map(([name, value]) => ({
        name,
        value,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      })),
    );
    expect(
      await browser.evaluate(async () =>
        Boolean(
          (
            await (
              await fetch("http://localhost:18080/api/auth/get-session", {
                credentials: "include",
              })
            ).json()
          )?.user,
        ),
      ),
    ).toBe(true);
    await app.open("http://localhost:13003/identity-access/people");
    await expect(
      screen.getByRole("heading", { name: "People", exact: true }),
    ).toBeVisible();
    await session.save("operator");
  },
);

test(
  "saved operator session reaches administration",
  { session: "operator" },
  async ({ app, screen }) => {
    await app.open("http://localhost:13003/identity-access/people");
    await expect(
      screen.getByRole("heading", { name: "People", exact: true }),
    ).toBeVisible();
  },
);
