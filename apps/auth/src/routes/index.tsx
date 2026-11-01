import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Field as FormField,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@repo/ui/components/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@repo/ui/components/input-otp";
import { Spinner } from "@repo/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { UserRoundKeyIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import {
  Aside,
  AuthForm,
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
import { signInOutcome, twoFactorFailure } from "../lib/sign-in";

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
  // Session token from the sign-in body. Used when the browser dropped the
  // cross-origin Set-Cookie and change-password has no cookie session yet.
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

      const outcome = signInOutcome(
        await attemptAuth(
          () => authClient.signIn.email(value),
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
          onTemporaryPassword(value.password, outcome.token);
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
      await onDone(outcome.token);
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

/**
 * The password an admin issued arrived by email and was seen by at least two
 * people, so it is replaced before the employee goes anywhere else.
 */
function ChoosePasswordStep({
  sessionToken,
  temporaryPassword,
  onDone,
}: {
  sessionToken: string;
  temporaryPassword: string;
  onDone: () => void | Promise<void>;
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

      const result = await attemptAuth(
        () =>
          authClient.changePassword({
            currentPassword: value.current,
            newPassword: value.password,
            revokeOtherSessions: true,
            fetchOptions: sessionToken
              ? { headers: { Authorization: `Bearer ${sessionToken}` } }
              : undefined,
          }),
        "That temporary password didn't match. Check your welcome email and try again.",
      );

      if (result.failure) {
        setFailure(result.failure);
        return;
      }

      void onDone();
    },
  });

  return (
    <AuthShell>
      <ScreenHeading focusOnMount title="Choose your password">
        Your account was set up with a temporary password. Replace it to finish.
      </ScreenHeading>

      <Panel>
        <AuthForm onSubmit={() => form.handleSubmit()}>
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
        </AuthForm>
      </Panel>

      <Aside>
        Saving signs out every other session. We check new passwords against
        known breaches.
      </Aside>
    </AuthShell>
  );
}

export function TwoFactorStep({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function verify() {
    setPending(true);
    setFailure(null);
    const result = await attemptAuth(
      () =>
        recovery
          ? authClient.twoFactor.verifyBackupCode({
              code,
              disableSession: false,
              trustDevice,
            })
          : authClient.twoFactor.verifyTotp({ code, trustDevice }),
      recovery
        ? "Enter an unused recovery code and try again."
        : "Enter the current 6-digit code and try again.",
    );
    setPending(false);
    const failure = twoFactorFailure(result);
    if (failure) setFailure(failure);
    else onDone();
  }

  return (
    <AuthShell>
      <ScreenHeading focusOnMount title="Verify it’s you">
        {recovery
          ? "Use one unused recovery code."
          : "Enter the six-digit code from your authenticator app."}
      </ScreenHeading>
      <Panel>
        <AuthForm onSubmit={verify}>
          {recovery ? (
            <Field
              id="two-factor-code"
              label="Recovery code"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          ) : (
            <FormField className="gap-1.5">
              <FieldLabel htmlFor="two-factor-code" className="text-xs">
                Authenticator code
              </FieldLabel>
              <InputOTP
                id="two-factor-code"
                aria-label="Authenticator code"
                autoComplete="one-time-code"
                autoFocus
                containerClassName="w-full justify-center"
                inputMode="numeric"
                maxLength={6}
                onChange={(value) =>
                  setCode(value.replace(/\D/g, "").slice(0, 6))
                }
                value={code}
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, index) => (
                    <InputOTPSlot index={index} key={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </FormField>
          )}
          <FormField orientation="horizontal">
            <Checkbox
              checked={trustDevice}
              id="trust-device"
              onCheckedChange={setTrustDevice}
            />
            <FieldContent className="gap-0.5">
              <FieldLabel htmlFor="trust-device" className="text-xs">
                Trust this device for 30 days
              </FieldLabel>
              <FieldDescription className="text-2xs">
                Only use this option on a device you do not share.
              </FieldDescription>
            </FieldContent>
          </FormField>
          {failure ? <FormError>{failure}</FormError> : null}
          <Submit pending={pending} pendingLabel="Verifying…">
            Verify
          </Submit>
        </AuthForm>
      </Panel>
      <Aside>
        <Button
          onClick={() => {
            setCode("");
            setFailure(null);
            setRecovery((value) => !value);
          }}
          size="xs"
          type="button"
          variant="link"
        >
          {recovery ? "Use authenticator code" : "Use a recovery code"}
        </Button>
        <Button
          onClick={() => window.location.reload()}
          size="xs"
          type="button"
          variant="link"
        >
          Sign in again
        </Button>
      </Aside>
    </AuthShell>
  );
}
