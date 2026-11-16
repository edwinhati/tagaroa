import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
} from "better-auth/api";
import { symmetricDecodeJWT, symmetricEncodeJWT } from "better-auth/crypto";
import { z } from "zod";

/**
 * Signing out of an app that signs in with Tagaroa (NetBird) ends at the door.
 *
 * The app sends the browser to the end-session endpoint. When Better Auth can
 * tie that to this browser's session it ends the session and redirects straight
 * back. Otherwise it answers with a bare page of its own, a confirmation or an
 * error, and in production its confirmation can never succeed: the cookie it
 * keeps takes the session cookie's `__Host-` prefix but a narrower path, which
 * browsers refuse. Every such page becomes the door's sign-out page instead.
 *
 * The door is handed the request already checked here, the app and a return
 * address that app registered, sealed so it can only send people back there.
 */
const SALT = "tagaroa.door-sign-out";
const SEALED_FOR_SECONDS = 10 * 60;

type SignOutRequest = { name: string; url: string };

type LogoutClient = {
  disabled?: boolean | null;
  enableEndSession?: boolean | null;
  name?: string | null;
  postLogoutRedirectUris?: string[] | null;
};

type Params = Record<string, unknown>;

const isParams = (value: unknown): value is Params =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The app's return address, if the app is allowed to sign people out there. */
const returnAddress = (client: LogoutClient | null, params: Params) => {
  const requested = params.post_logout_redirect_uri;
  if (
    !client ||
    client.disabled ||
    !client.enableEndSession ||
    typeof requested !== "string" ||
    !client.postLogoutRedirectUris?.includes(requested)
  )
    return undefined;
  const url = new URL(requested);
  if (typeof params.state === "string" && params.state)
    url.searchParams.set("state", params.state);
  return url.toString();
};

export const doorSignOut = (signInURL: string) =>
  ({
    id: "door-sign-out",
    hooks: {
      after: [
        {
          matcher: (ctx) => ctx.path === "/oauth2/end-session",
          handler: createAuthMiddleware(async (ctx) => {
            const answer = ctx.context.returned;
            if (
              !(answer instanceof Response) ||
              !answer.headers.get("content-type")?.startsWith("text/html")
            )
              return;

            const params = {
              ...ctx.query,
              ...(isParams(ctx.body) ? ctx.body : {}),
            };
            const clientId = params.client_id;
            const client =
              typeof clientId === "string"
                ? await ctx.context.adapter.findOne<LogoutClient>({
                    model: "oauthClient",
                    where: [{ field: "clientId", value: clientId }],
                  })
                : null;
            const url = returnAddress(client, params);

            const door = new URL("/sign-out", signInURL);
            if (url) {
              const request: SignOutRequest = {
                name: client?.name || "The app",
                url,
              };
              door.searchParams.set(
                "request",
                await symmetricEncodeJWT(
                  request,
                  ctx.context.secret,
                  SALT,
                  SEALED_FOR_SECONDS,
                ),
              );
            }
            throw ctx.redirect(door.toString());
          }),
        },
      ],
    },
    endpoints: {
      /** Where the door sends someone after they sign out, from a sealed request. */
      signOutReturn: createAuthEndpoint(
        "/sign-out/return",
        { method: "GET", query: z.object({ request: z.string().min(1) }) },
        async (ctx) => {
          const request = await symmetricDecodeJWT<SignOutRequest>(
            ctx.query.request,
            ctx.context.secret,
            SALT,
          );
          if (
            typeof request?.url !== "string" ||
            typeof request.name !== "string"
          )
            throw new APIError("BAD_REQUEST", {
              message: "This sign-out link has expired.",
            });
          return ctx.json({ name: request.name, url: request.url });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
