import { attemptAuth } from "@repo/shell/attempt-auth";
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
import { useState } from "react";

import { authClient } from "../lib/auth-client";
import { twoFactorFailure } from "../lib/sign-in";
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
