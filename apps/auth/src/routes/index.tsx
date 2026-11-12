import { Spinner } from "@repo/ui/components/spinner";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";

import { AuthShell, Panel, ScreenHeading } from "../components/auth-shell";
import { ChoosePasswordStep } from "../components/choose-password-step";
import { SignInStep } from "../components/sign-in-step";
import { TwoFactorStep } from "../components/two-factor-step";
import { authClient, postSignInTarget } from "../lib/auth-client";
import { sessionQueryOptions, signInDestination } from "../lib/session";

const SecureAccountStep = lazy(async () => {
  const module = await import("../components/secure-account-step");
  return { default: module.SecureAccountStep };
});

function SecureAccountFallback() {
  return (
    <AuthShell>
      <ScreenHeading title="Secure your account">
        Preparing authenticator setup.
      </ScreenHeading>
      <Panel>
        <div
          className="gap-2 py-4 text-sm flex items-center justify-center text-muted-foreground"
          role="status"
        >
          <Spinner aria-hidden="true" data-icon="inline-start" />
          Loading security setup…
        </div>
      </Panel>
    </AuthShell>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Sign in · Tagaroa" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    const destination = signInDestination(
      await context.queryClient.ensureQueryData(sessionQueryOptions),
    );

    if (destination.to === "workspace") {
      const target = postSignInTarget(search.redirect);
      // Without VITE_POST_SIGNIN_URL the target falls back to "/", which is this
      // page: bouncing there would loop, so the form renders instead.
      if (new URL(target, window.location.href).href !== window.location.href) {
        throw redirect({ href: target });
      }
    }

    // Someone who signed in earlier and left before choosing a password comes
    // back to the second step, with no memory of what they typed.
    return { initialDestination: destination.to };
  },
  component: SignIn,
});

/**
 * One page, two steps. An admin-issued password is replaced before the
 * workspace is reachable, and since that password was just typed into the form
 * below, the second step does not ask for it again.
 */
function SignIn() {
  const { redirect } = Route.useSearch();
  const { initialDestination } = Route.useRouteContext();

  // null while the credentials step is showing. Otherwise the temporary password
  // to change away from, empty when we did not see it being typed.
  const [step, setStep] = useState<
    "sign-in" | "choose-password" | "two-factor" | "secure-account"
  >(
    initialDestination === "choose-password"
      ? "choose-password"
      : initialDestination === "secure-account"
        ? "secure-account"
        : "sign-in",
  );
  const [temporaryPassword, setTemporaryPassword] = useState("");
  // Signed session token from sign-in's `set-auth-token` header. Used when the
  // browser dropped the cross-origin Set-Cookie and change-password has no
  // cookie session yet.
  const [sessionToken, setSessionToken] = useState("");

  function leaveForWorkspace() {
    window.location.assign(postSignInTarget(redirect));
  }

  if (step === "two-factor") {
    return <TwoFactorStep onDone={leaveForWorkspace} />;
  }
  if (step === "secure-account") {
    return (
      <Suspense fallback={<SecureAccountFallback />}>
        <SecureAccountStep onDone={leaveForWorkspace} />
      </Suspense>
    );
  }
  if (step === "choose-password") {
    return (
      <ChoosePasswordStep
        sessionToken={sessionToken}
        temporaryPassword={temporaryPassword}
        onDone={async () => {
          const { data } = await authClient.getSession(
            sessionToken
              ? {
                  fetchOptions: {
                    headers: { Authorization: `Bearer ${sessionToken}` },
                  },
                }
              : undefined,
          );
          if (signInDestination(data).to === "secure-account") {
            setStep("secure-account");
          } else {
            leaveForWorkspace();
          }
        }}
      />
    );
  }
  return (
    <SignInStep
      onTemporaryPassword={(password, token) => {
        setTemporaryPassword(password);
        setSessionToken(token);
        setStep("choose-password");
      }}
      onTwoFactor={() => setStep("two-factor")}
      onDone={async (token) => {
        if (token) setSessionToken(token);
        // Cookie session first — bearer alone cannot admit the workspace app.
        let { data } = await authClient.getSession();
        if (data == null && token) {
          ({ data } = await authClient.getSession({
            fetchOptions: {
              headers: { Authorization: `Bearer ${token}` },
            },
          }));
        }
        const destination = signInDestination(data);
        const cookieSession = await authClient.getSession();
        // Do not hand off without a cookie session — workspace admit will only
        // bounce back to this form and look like a login loop.
        if (cookieSession.data == null) {
          return;
        }
        if (destination.to === "secure-account") {
          setStep("secure-account");
        } else {
          leaveForWorkspace();
        }
      }}
    />
  );
}
