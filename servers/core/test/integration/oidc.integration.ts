import { describe, expect, test } from "bun:test";

import { AuthService } from "@thallesp/nestjs-better-auth";

import type { Auth } from "../../src/modules/auth/auth";
import { registerOAuthClient } from "../../src/modules/auth/oauth-clients";
import {
  DATABASE,
  type Database,
} from "../../src/platform/database/database.module";
import { testEnv } from "../database";
import {
  adminCookie,
  app,
  cookieJar,
  issueAccount,
  request,
  serveCore,
  sessionUserId,
} from "./harness";

serveCore();

const issuer = `${testEnv.BETTER_AUTH_URL}/api/auth`;
const redirectUri = "https://vpn.example/oauth2/callback";
const logoutUri = "https://vpn.example/oauth2/logout/callback";

const register = async () => {
  const owner = await sessionUserId(await adminCookie("super-admin"));
  const auth = app.get<AuthService<Auth>>(AuthService).instance;
  return registerOAuthClient(
    auth,
    owner,
    "NetBird",
    [redirectUri],
    [logoutUri],
  );
};

/** A browser navigation, so Better Auth answers with a redirect, not JSON. */
const authorize = (clientId: string, cookie = "", extra = "") =>
  request(
    `/api/auth/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid+profile+email&state=s1${extra}`,
    { headers: { accept: "text/html", cookie }, redirect: "manual" },
  );

const signedIn = async (mustChangePassword: boolean) => {
  const employee = await issueAccount("Temporary-Password-1234");
  await app.get<Database>(DATABASE).$client`
    update auth."user" set must_change_password = ${mustChangePassword}
    where email = ${employee.email}`;
  const jar = cookieJar();
  expect((await jar.post("/api/auth/sign-in/email", employee)).status).toBe(
    200,
  );
  return { ...employee, jar };
};

const oauthQuery = (location: string) => new URL(location).search.slice(1);

describe("Tagaroa as an OIDC provider", () => {
  test("publishes discovery under the issuer, signing with RS256", async () => {
    const response = await request(
      "/api/auth/.well-known/openid-configuration",
    );
    expect(response.status).toBe(200);
    const metadata = await response.json();
    expect(metadata.issuer).toBe(issuer);
    expect(metadata.authorization_endpoint).toBe(`${issuer}/oauth2/authorize`);
    expect(metadata.id_token_signing_alg_values_supported).toContain("RS256");
  });

  test("sends someone without a session to the door, and signs them in there", async () => {
    const client = await register();
    const toDoor = await authorize(client.client_id);
    expect(toDoor.status).toBe(302);
    const door = new URL(toDoor.headers.get("location")!);
    expect(door.origin).toBe(new URL(testEnv.SIGN_IN_URL).origin);
    expect(door.searchParams.get("sig")).toBeTruthy();

    // The door signs the person in, then continues the request it was handed.
    const employee = await signedIn(false);
    const continued = await request("/api/auth/oauth2/continue", {
      method: "POST",
      headers: { cookie: employee.jar.header() },
      body: JSON.stringify({
        postLogin: true,
        oauth_query: oauthQuery(door.href),
      }),
    });
    expect(continued.status).toBe(200);
    const { url } = await continued.json();
    const callback = new URL(url);
    expect(`${callback.origin}${callback.pathname}`).toBe(redirectUri);
    expect(callback.searchParams.get("state")).toBe("s1");

    const token = await request("/api/auth/oauth2/token", {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${client.client_id}:${client.client_secret}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: callback.searchParams.get("code")!,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    expect(token.status).toBe(200);
    const { id_token } = await token.json();
    const [header, payload] = (id_token as string)
      .split(".")
      .slice(0, 2)
      .map((part) => JSON.parse(Buffer.from(part, "base64url").toString()));
    expect(header.alg).toBe("RS256");
    expect(payload).toMatchObject({
      aud: client.client_id,
      email: employee.email,
      iss: issuer,
    });
  });

  test("holds someone the apps would not admit until the door has onboarded them", async () => {
    const client = await register();
    const employee = await signedIn(true);
    const held = await authorize(client.client_id, employee.jar.header());
    expect(held.status).toBe(302);
    const door = held.headers.get("location")!;
    expect(new URL(door).origin).toBe(new URL(testEnv.SIGN_IN_URL).origin);

    const tooSoon = await request("/api/auth/oauth2/continue", {
      method: "POST",
      headers: { cookie: employee.jar.header() },
      body: JSON.stringify({ postLogin: true, oauth_query: oauthQuery(door) }),
    });
    expect(new URL((await tooSoon.json()).url).origin).toBe(
      new URL(testEnv.SIGN_IN_URL).origin,
    );
  });

  test("the door accepts consent when the client asks for it", async () => {
    const client = await register();
    const employee = await signedIn(false);
    const asked = await authorize(
      client.client_id,
      employee.jar.header(),
      "&prompt=consent",
    );
    const door = asked.headers.get("location")!;
    expect(new URL(door).origin).toBe(new URL(testEnv.SIGN_IN_URL).origin);

    const accepted = await request("/api/auth/oauth2/consent", {
      method: "POST",
      headers: { cookie: employee.jar.header() },
      body: JSON.stringify({ accept: true, oauth_query: oauthQuery(door) }),
    });
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).url).toStartWith(`${redirectUri}?code=`);
  });

  test("signs someone out when the client asks, then sends them back to it", async () => {
    const client = await register();
    const employee = await signedIn(false);
    // NetBird's Dex sends its client ID and callback, without an id_token_hint,
    // so the door asks the person to confirm first.
    const asked = await request(
      `/api/auth/oauth2/end-session?client_id=${client.client_id}&post_logout_redirect_uri=${encodeURIComponent(logoutUri)}`,
      {
        headers: { accept: "text/html", cookie: employee.jar.header() },
        redirect: "manual",
      },
    );
    expect(asked.status).toBe(200);
    expect(await asked.text()).toContain("Confirm logout");

    const confirmation = asked.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";", 1)[0]);
    const confirmed = await request("/api/auth/oauth2/end-session/confirm", {
      method: "POST",
      headers: {
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded",
        cookie: [employee.jar.header(), ...confirmation].join("; "),
      },
      body: "action=confirm",
      redirect: "manual",
    });
    expect(confirmed.headers.get("location")).toBe(logoutUri);
    expect(
      (
        await request("/api/auth/get-session", {
          headers: { cookie: employee.jar.header() },
        })
      ).json(),
    ).resolves.toBeNull();
  });
});
