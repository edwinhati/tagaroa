import { attemptAuth } from "@repo/shell/attempt-auth";
import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { UserRoundKeyIcon } from "lucide-react";
import { useState } from "react";

import { authClient } from "../lib/auth-client";
import { errorFor, signInSchema } from "../lib/forms";
import { signInOutcome } from "../lib/sign-in";
import {
  AuthForm,
  AuthShell,
  Field,
  FormError,
  Panel,
  ScreenHeading,
  Submit,
} from "./auth-shell";

export function SignInStep({
  actionLabel = "Sign in",
  description,
  emailReadOnly = false,
  heading = "Sign in to Tagaroa",
  initialEmail = "",
  onTemporaryPassword,
  onTwoFactor,
  onDone,
  pendingLabel = "Signing in…",
  showPasskey = true,
}: {
  actionLabel?: string;
  description?: string;
  emailReadOnly?: boolean;
  heading?: string;
  initialEmail?: string;
  onTemporaryPassword: (password: string, sessionToken: string) => void;
  onTwoFactor: () => void;
  onDone: (sessionToken?: string) => void | Promise<void>;
  pendingLabel?: string;
  showPasskey?: boolean;
}) {
  const navigate = useNavigate();
  // The server's verdict on the credentials, which no schema can predict.
  const [failure, setFailure] = useState<string | null>(null);
  const [alternativePending, setAlternativePending] = useState(false);

  async function signInWithPasskey() {
    setAlternativePending(true);
    setFailure(null);
    const result = await attemptAuth(
      () => authClient.signIn.passkey(),
      "Passkey sign-in did not finish. Try again or use your password.",
    );
    setAlternativePending(false);
    if (result.failure) setFailure(result.failure);
    else void onDone();
  }

  const form = useForm({
    defaultValues: { email: initialEmail, password: "" },
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      setFailure(null);

      // The bearer plugin's signed `set-auth-token`, never the body's raw
      // token: core accepts only a signed bearer.
      let token = "";
      const outcome = signInOutcome(
        await attemptAuth(
          () =>
            authClient.signIn.email({
              ...value,
              fetchOptions: {
                onSuccess: ({ response }) => {
                  token = response.headers.get("set-auth-token") ?? "";
                },
              },
            }),
          "That email and password don't match an account. Check both and try again.",
        ),
      );

      switch (outcome.kind) {
        case "locked-out":
          void navigate({
            to: "/locked-out",
            search: { reason: outcome.reason },
          });
          return;
        case "failure":
          setFailure(outcome.failure);
          return;
        case "two-factor":
          onTwoFactor();
          return;
        case "choose-password":
          onTemporaryPassword(value.password, token);
          return;
      }

      // Check before onDone can navigate and abort requests from this document.
      const cookieCheck = await authClient.getSession();
      if (cookieCheck.data == null) {
        setFailure(
          "Signed in, but this browser did not keep the session cookie. Allow cookies for localhost, clear old localhost cookies, then try again.",
        );
        return;
      }
      await onDone(token);
    },
  });

  return (
    <AuthShell>
      <ScreenHeading title={heading}>{description}</ScreenHeading>

      <Panel>
        <AuthForm onSubmit={() => form.handleSubmit()}>
          <form.Field name="email">
            {(field) => (
              <Field
                id={field.name}
                name={field.name}
                type="email"
                label="Email"
                placeholder="you@tagaroa.com"
                autoComplete="username"
                autoFocus={!emailReadOnly}
                readOnly={emailReadOnly}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                error={errorFor(field.state.meta)}
              />
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <Field
                id={field.name}
                name={field.name}
                type="password"
                label="Password"
                autoComplete="current-password"
                autoFocus={emailReadOnly}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                error={errorFor(field.state.meta)}
                hint={
                  <Link
                    viewTransition
                    to="/locked-out"
                    className="underline hover:text-[color:var(--sea)]"
                  >
                    Forgot password?
                  </Link>
                }
              />
            )}
          </form.Field>

          {failure ? <FormError>{failure}</FormError> : null}

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Submit pending={isSubmitting} pendingLabel={pendingLabel}>
                {actionLabel}
              </Submit>
            )}
          </form.Subscribe>
          {showPasskey ? (
            <Button
              className="mt-2.5 w-full"
              disabled={alternativePending}
              onClick={() => void signInWithPasskey()}
              type="button"
              variant="outline"
            >
              {alternativePending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : (
                <UserRoundKeyIcon aria-hidden="true" data-icon="inline-start" />
              )}
              {alternativePending
                ? "Waiting for passkey…"
                : "Sign in with a passkey"}
            </Button>
          ) : null}
        </AuthForm>
      </Panel>
    </AuthShell>
  );
}
