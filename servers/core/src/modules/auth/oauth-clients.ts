import { makeSignature } from "better-auth/crypto";

import type { Auth } from "./auth";

/**
 * Registers an app that signs people in with Tagaroa over OIDC (NetBird), owned
 * by a super-admin. Every client is first-party: an operator registers it, and
 * the door accepts consent for it. It authenticates with its secret, which is
 * returned here once and never again.
 *
 * Better Auth registers a client only for a signed-in owner, so the owner is
 * signed in for this one call and the session is ended straight after.
 */
export const registerOAuthClient = async (
  auth: Auth,
  ownerId: string,
  name: string,
  redirectUris: string[],
  postLogoutRedirectUris: string[] = [],
) => {
  const context = await auth.$context;
  const { token } = await context.internalAdapter.createSession(ownerId);
  try {
    const signed = `${token}.${await makeSignature(token, context.secret)}`;
    return await auth.api.adminCreateOAuthClient({
      body: {
        client_name: name,
        // Signing out of the app signs out of Tagaroa too: NetBird's Dex sends
        // the browser to the end-session endpoint with its client ID and
        // `<its issuer>/logout/callback` to come back to.
        enable_end_session: true,
        grant_types: ["authorization_code", "refresh_token"],
        ...(postLogoutRedirectUris.length > 0 && {
          post_logout_redirect_uris: postLogoutRedirectUris,
        }),
        redirect_uris: redirectUris,
        // Dex, NetBird's login, sends no PKCE challenge upstream.
        require_pkce: false,
        response_types: ["code"],
        scope: "openid profile email offline_access",
        skip_consent: true,
        token_endpoint_auth_method: "client_secret_basic",
      },
      headers: new Headers({
        cookie: `${context.authCookies.sessionToken.name}=${signed}`,
      }),
    });
  } finally {
    await context.internalAdapter.deleteSession(token);
  }
};
