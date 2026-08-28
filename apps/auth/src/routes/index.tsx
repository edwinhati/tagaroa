import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";

import {
  Aside,
  AuthShell,
  Field,
  FormError,
  Panel,
  ScreenHeading,
  Submit,
} from "../components/auth-shell";
import {
  attemptAuth,
  authClient,
  MIN_PASSWORD_LENGTH,
  postSignInTarget,
} from "../lib/auth-client";
import { errorFor, newPasswordSchema, signInSchema } from "../lib/forms";
import { sessionQueryOptions, signInDestination } from "../lib/session";

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
    return { openOnPasswordStep: destination.to === "choose-password" };
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
  const { openOnPasswordStep } = Route.useRouteContext();

  // null while the credentials step is showing. Otherwise the temporary password
  // to change away from, empty when we did not see it being typed.
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    openOnPasswordStep ? "" : null,
  );

  function leaveForWorkspace() {
    window.location.assign(postSignInTarget(redirect));
  }

  return temporaryPassword === null ? (
    <SignInStep
      onTemporaryPassword={setTemporaryPassword}
      onDone={leaveForWorkspace}
    />
  ) : (
    <ChoosePasswordStep
      temporaryPassword={temporaryPassword}
      onDone={leaveForWorkspace}
    />
  );
}

function SignInStep({
  onTemporaryPassword,
  onDone,
}: {
  onTemporaryPassword: (password: string) => void;
  onDone: () => void;
}) {
  // The server's verdict on the credentials, which no schema can predict.
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      setFailure(null);

      const { data, failure } = await attemptAuth(
        () => authClient.signIn.email(value),
        "That email and password don't match an account.",
      );

      if (failure) {
        setFailure(failure);
        return;
      }

      const mustChange = (
        data?.user as { mustChangePassword?: boolean } | undefined
      )?.mustChangePassword;

      if (mustChange) {
        onTemporaryPassword(value.password);
        return;
      }

      onDone();
    },
  });

  return (
    <AuthShell>
      <ScreenHeading title="Sign in to Tagaroa" />

      <Panel>
        <form
          noValidate
          className="gap-5 grid"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="email">
            {(field) => (
              <Field
                id={field.name}
                name={field.name}
                type="email"
                label="Email"
                placeholder="you@tagaroa.com"
                autoComplete="username"
                autoFocus
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
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                error={errorFor(field.state.meta)}
                hint={
                  <Link
                    viewTransition
                    to="/locked-out"
                    className="hover:text-foreground"
                  >
                    Locked out?
                  </Link>
                }
              />
            )}
          </form.Field>

          {failure ? <FormError>{failure}</FormError> : null}

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Submit pending={isSubmitting} pendingLabel="Signing in…">
                Sign in
              </Submit>
            )}
          </form.Subscribe>
        </form>
      </Panel>
    </AuthShell>
  );
}

/**
 * The password an admin issued arrived by email and was seen by at least two
 * people, so it is replaced before the employee goes anywhere else.
 */
function ChoosePasswordStep({
  temporaryPassword,
  onDone,
}: {
  temporaryPassword: string;
  onDone: () => void;
}) {
  const [failure, setFailure] = useState<string | null>(null);

  // Known only when this same page watched it being typed a moment ago. On a
  // fresh load it is empty, and the field below asks for it.
  const knowsTemporaryPassword = temporaryPassword.length > 0;

  const form = useForm({
    defaultValues: { current: temporaryPassword, password: "", confirm: "" },
    validators: { onSubmit: newPasswordSchema },
    onSubmit: async ({ value }) => {
      setFailure(null);

      const { failure } = await attemptAuth(
        () =>
          authClient.changePassword({
            currentPassword: value.current,
            newPassword: value.password,
            revokeOtherSessions: true,
          }),
        "That temporary password didn't match. Check the email.",
      );

      if (failure) {
        setFailure(failure);
        return;
      }

      onDone();
    },
  });

  return (
    <AuthShell>
      <ScreenHeading title="Choose your password">
        Your account was set up with a temporary password. Replace it to finish.
      </ScreenHeading>

      <Panel>
        <form
          noValidate
          className="gap-5 grid"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          {knowsTemporaryPassword ? null : (
            <form.Field name="current">
              {(field) => (
                <Field
                  id={field.name}
                  name={field.name}
                  type="password"
                  label="Temporary password"
                  autoComplete="current-password"
                  autoFocus
                  hint="From your welcome email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  error={errorFor(field.state.meta)}
                />
              )}
            </form.Field>
          )}

          <form.Field name="password">
            {(field) => (
              <Field
                id={field.name}
                name={field.name}
                type="password"
                label="New password"
                autoComplete="new-password"
                autoFocus={knowsTemporaryPassword}
                hint={`${MIN_PASSWORD_LENGTH} characters minimum`}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                error={errorFor(field.state.meta)}
              />
            )}
          </form.Field>

          <form.Field name="confirm">
            {(field) => (
              <Field
                id={field.name}
                name={field.name}
                type="password"
                label="Confirm password"
                autoComplete="new-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                error={errorFor(field.state.meta)}
              />
            )}
          </form.Field>

          {failure ? <FormError>{failure}</FormError> : null}

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Submit pending={isSubmitting} pendingLabel="Saving…">
                Save and continue
              </Submit>
            )}
          </form.Subscribe>
        </form>
      </Panel>

      <Aside>
        Saving signs out every other session. We check new passwords against
        known breaches.
      </Aside>
    </AuthShell>
  );
}
