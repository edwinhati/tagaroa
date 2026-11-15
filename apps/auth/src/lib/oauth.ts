import { attemptAuth } from "@repo/shell/attempt-auth";

import { authClient } from "./auth-client";

/**
 * The sign-in request another app (NetBird) made, as core signed it when it sent
 * the person here: only the parameters it signed, as Better Auth's own client
 * sends them. Undefined on an ordinary visit.
 */
export function signedOAuthQuery(
  search: string = window.location.search,
): string | undefined {
  const params = new URLSearchParams(search);
  const signed = new Set(params.getAll("ba_param"));
  if (!params.has("sig") || signed.size === 0) return undefined;
  const kept = new URLSearchParams();
  for (const [key, value] of params) {
    if (key === "sig" || key === "ba_param" || signed.has(key))
      kept.append(key, value);
  }
  return kept.toString();
}

/**
 * Hands a signed-in, onboarded person back to the app that asked. Core checks
 * admission again and answers with where to go next; Better Auth's client
 * follows that answer itself. Every client is first-party, so when the app asked
 * for consent the door gives it rather than asking. Answers the failure to show.
 */
export async function finishOAuth(query: string): Promise<string | undefined> {
  const prompts = new URLSearchParams(query).get("prompt")?.split(" ") ?? [];
  const result = await attemptAuth(
    () =>
      prompts.includes("consent")
        ? authClient.$fetch("/oauth2/consent", {
            body: { accept: true, oauth_query: query },
            method: "POST",
          })
        : authClient.$fetch("/oauth2/continue", {
            body: { oauth_query: query, postLogin: true },
            method: "POST",
          }),
    "Signed in, but the app that sent you here could not be reached. Go back to it and try again.",
  );
  return result.failure;
}
