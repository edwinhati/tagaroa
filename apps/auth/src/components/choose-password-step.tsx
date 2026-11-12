import { PASSWORD_LENGTH } from "@repo/contracts/identity";
import { attemptAuth } from "@repo/shell/attempt-auth";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import { authClient } from "../lib/auth-client";
import { errorFor, newPasswordSchema } from "../lib/forms";
import {
  Aside,
  AuthForm,
  AuthShell,
  Field,
  FormError,
  Panel,
  ScreenHeading,
  Submit,
} from "./auth-shell";

/**
 * The password an admin issued arrived by email and was seen by at least two
 * people, so it is replaced before the employee goes anywhere else.
 */
export function ChoosePasswordStep({
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
                hint={`${PASSWORD_LENGTH.min} characters minimum`}
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
