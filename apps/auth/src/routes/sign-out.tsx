import { WORKSPACE_URL } from "@repo/shell/urls";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";

import {
  Aside,
  AuthForm,
  AuthShell,
  FormError,
  Panel,
  ScreenHeading,
  Submit,
} from "../components/auth-shell";
import { signOutHere, signOutReturn } from "../lib/oauth";
import { sessionQueryOptions } from "../lib/session";

/**
 * Where an app that signs in with Tagaroa (NetBird) sends someone to sign out,
 * when core could not finish that on its own. With a sealed `request` from
 * core, the page names the app and takes the person back to it afterwards.
 */
export const Route = createFileRoute("/sign-out")({
  head: () => ({ meta: [{ title: "Sign out · Tagaroa" }] }),
  validateSearch: (search: Record<string, unknown>): { request?: string } =>
    typeof search.request === "string" ? { request: search.request } : {},
  loaderDeps: ({ search }) => ({ request: search.request }),
  loader: async ({ context, deps }) => {
    const [session, back] = await Promise.all([
      context.queryClient.ensureQueryData(sessionQueryOptions),
      deps.request ? signOutReturn(deps.request) : undefined,
    ]);
    const signedIn = Boolean(session?.user?.id);
    // No Tagaroa session left to end: the app finishes its own sign-out.
    if (!signedIn && back) throw redirect({ href: back.url });
    return { back, signedIn };
  },
  component: SignOut,
});

const linkClass = "underline hover:text-[color:var(--sea)]";

function SignOut() {
  const { back, signedIn } = Route.useLoaderData();
  const [signedOut, setSignedOut] = useState(!signedIn);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();

  async function signOut() {
    setPending(true);
    setFailure(undefined);
    const failed = await signOutHere();
    if (failed) {
      setPending(false);
      setFailure(failed);
      return;
    }
    if (back) window.location.assign(back.url);
    else setSignedOut(true);
  }

  if (signedOut) {
    return (
      <AuthShell>
        <ScreenHeading focusOnMount title="You’re signed out">
          Your Tagaroa session in this browser has ended.
        </ScreenHeading>
        <Aside>
          <Link
            className={linkClass}
            search={{ redirect: undefined }}
            to="/"
            viewTransition
          >
            Sign in again
          </Link>
        </Aside>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <ScreenHeading focusOnMount title="Sign out of Tagaroa">
        {back
          ? `${back.name} is signing you out. Sign out of Tagaroa in this browser too?`
          : "This ends your Tagaroa session in this browser."}
      </ScreenHeading>
      <Panel>
        <AuthForm onSubmit={signOut}>
          {failure ? <FormError>{failure}</FormError> : null}
          <Submit pending={pending} pendingLabel="Signing out…">
            Sign out
          </Submit>
        </AuthForm>
      </Panel>
      <Aside>
        {back ? (
          <a className={linkClass} href={back.url}>
            Stay signed in to Tagaroa
          </a>
        ) : (
          <a className={linkClass} href={WORKSPACE_URL}>
            Back to the workspace
          </a>
        )}
      </Aside>
    </AuthShell>
  );
}
