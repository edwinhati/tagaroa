import { PasswordInput } from "@repo/ui/blocks/password-input";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import {
  Field as FormField,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@repo/ui/components/input-otp";
import { Label } from "@repo/ui/components/label";
import { Separator } from "@repo/ui/components/separator";
import { Spinner } from "@repo/ui/components/spinner";
import { QRCodeSVG } from "qrcode.react";
import { useState, type FormEvent, type ReactNode } from "react";

import { attemptAuth } from "./attempt-auth";
import type { WorkspaceAuthClient } from "./create-auth-client";
import { formatSetupKey, setupKeyFromTotpUri } from "./totp";

function FormError({ children }: { children: ReactNode }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function RecoveryCodesView({
  backupCodes,
  completionLabel,
  onDone,
  title,
}: {
  backupCodes: string[];
  completionLabel: string;
  onDone: () => void;
  title: string;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="gap-4 flex flex-col">
      <div>
        <h2 className="text-sm font-medium tracking-[-0.01em]">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Each code works once. Store them somewhere separate from this device.
          If you leave before saving them, replace them in Account settings.
        </p>
      </div>
      <FieldGroup className="gap-4">
        {/* One <pre> keeps the codes copyable as lines; two columns halve its
            height so ten codes sit above the fold. */}
        <pre className="p-3 font-mono text-xs leading-6 gap-x-4 columns-2 rounded-lg border border-border bg-transparent whitespace-pre-wrap select-all">
          {backupCodes.join("\n")}
        </pre>
        <FormField orientation="horizontal">
          <Checkbox
            checked={acknowledged}
            id="recovery-codes-saved"
            onCheckedChange={setAcknowledged}
          />
          <FieldLabel className="text-xs" htmlFor="recovery-codes-saved">
            I saved these recovery codes.
          </FieldLabel>
        </FormField>
        <Button
          className="w-full"
          disabled={!acknowledged}
          onClick={onDone}
          size="sm"
          type="button"
        >
          {completionLabel}
        </Button>
      </FieldGroup>
    </div>
  );
}

export function RecoveryCodesFlow({
  cancelLabel = "Back",
  client,
  completionLabel = "Done",
  hideIntro = false,
  onCancel,
  onDone,
}: {
  cancelLabel?: string;
  client: WorkspaceAuthClient;
  completionLabel?: string;
  hideIntro?: boolean;
  onCancel?: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function generate(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setFailure(null);
    const result = await attemptAuth(
      () => client.twoFactor.generateBackupCodes({ password }),
      "Recovery codes could not be replaced. Check your password and try again.",
    );
    setPending(false);
    if (result.failure) return setFailure(result.failure);
    if (result.data?.backupCodes) setBackupCodes(result.data.backupCodes);
  }

  if (backupCodes.length > 0) {
    return (
      <RecoveryCodesView
        backupCodes={backupCodes}
        completionLabel={completionLabel}
        onDone={onDone}
        title="Save your new recovery codes"
      />
    );
  }

  return (
    <div className="gap-4 flex flex-col">
      {hideIntro ? null : (
        <div>
          <h2 className="text-sm font-medium tracking-[-0.01em]">
            Replace recovery codes
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Your current recovery codes stop working as soon as you replace
            them.
          </p>
        </div>
      )}
      <form className="gap-3 flex flex-col" onSubmit={generate}>
        <div className="gap-1.5 flex flex-col">
          <Label htmlFor="recovery-password">Current password</Label>
          <PasswordInput
            autoComplete="current-password"
            autoFocus
            id="recovery-password"
            onChange={(event) => setPassword(event.target.value)}
            value={password}
          />
        </div>
        {failure ? <FormError>{failure}</FormError> : null}
        <div className="gap-2 flex flex-wrap">
          <Button disabled={pending || !password} size="sm" type="submit">
            {pending ? (
              <Spinner aria-hidden="true" data-icon="inline-start" />
            ) : null}
            {pending ? "Replacing…" : "Replace recovery codes"}
          </Button>
          {onCancel ? (
            <Button
              disabled={pending}
              onClick={onCancel}
              size="sm"
              type="button"
              variant="ghost"
            >
              {cancelLabel}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

export function AuthenticatorSetupFlow({
  cancelLabel = "Back",
  client,
  completionLabel = "Done",
  hideIntro = false,
  onCancel,
  onDone,
}: {
  cancelLabel?: string;
  client: WorkspaceAuthClient;
  completionLabel?: string;
  hideIntro?: boolean;
  onCancel?: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verified, setVerified] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const setupKey = totpURI ? setupKeyFromTotpUri(totpURI) : null;

  async function begin(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setFailure(null);
    const result = await attemptAuth(
      () => client.twoFactor.enable({ method: "totp", password }),
      "Two-factor setup could not start. Check your password and try again.",
    );
    setPending(false);
    if (result.failure) return setFailure(result.failure);
    if (result.data?.method === "totp") {
      setTotpURI(result.data.totpURI ?? null);
      setBackupCodes(result.data.backupCodes ?? []);
      setPassword("");
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setFailure(null);
    const result = await attemptAuth(
      () => client.twoFactor.verifyTotp({ code, trustDevice: false }),
      "Enter the current 6-digit code and try again.",
    );
    setPending(false);
    if (result.failure) setFailure(result.failure);
    else setVerified(true);
  }

  async function copySetupKey() {
    if (!setupKey) return;
    try {
      await navigator.clipboard.writeText(setupKey);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  if (verified) {
    return (
      <RecoveryCodesView
        backupCodes={backupCodes}
        completionLabel={completionLabel}
        onDone={onDone}
        title="Save your recovery codes"
      />
    );
  }

  if (totpURI) {
    // The QR is the one thing to look at, so it leads, centred and larger, with
    // its two actions as full-width rows under it. The code form is a second
    // beat after a hairline; the 6 slots fill the width as two groups of three.
    return (
      <div className="gap-5 flex flex-col">
        <section
          aria-labelledby="scan-authenticator-heading"
          className="gap-3 flex flex-col"
        >
          <div>
            <h2
              className="text-sm font-medium tracking-[-0.01em]"
              id="scan-authenticator-heading"
            >
              Scan this QR code
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              In your authenticator app, add an account and choose Scan QR code.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="p-1 rounded-lg border border-border bg-transparent shadow-none">
              <QRCodeSVG
                bgColor="#ffffff"
                className="size-[11rem] h-auto max-w-full"
                fgColor="#111827"
                level="M"
                marginSize={4}
                role="img"
                size={176}
                title="Authenticator setup QR code"
                value={totpURI}
              />
            </div>
          </div>

          <div className="gap-1 flex flex-col">
            <Button
              className="w-full"
              nativeButton={false}
              render={<a href={totpURI} />}
              size="sm"
              variant="outline"
            >
              Open authenticator app
            </Button>

            {setupKey ? (
              <Collapsible>
                <CollapsibleTrigger
                  render={
                    <Button
                      className="w-full"
                      size="sm"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  Can’t scan the code?
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 p-3 gap-2 text-xs grid rounded-lg border border-border bg-transparent">
                  <span className="font-medium">Enter this setup key</span>
                  <div className="gap-3 flex items-start justify-between">
                    <code
                      className="font-mono text-xs leading-relaxed min-w-0 break-words select-all"
                      translate="no"
                    >
                      {formatSetupKey(setupKey)}
                    </code>
                    <Button
                      className="shrink-0"
                      onClick={() => void copySetupKey()}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      {copyStatus === "copied" ? "Copied" : "Copy key"}
                    </Button>
                  </div>
                  <span
                    aria-live="polite"
                    className="text-2xs text-muted-foreground"
                  >
                    {copyStatus === "copied"
                      ? "Key copied"
                      : copyStatus === "failed"
                        ? "Select and copy the key"
                        : "Keep this key private"}
                  </span>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        </section>

        <Separator />

        <form className="gap-3 flex flex-col" onSubmit={verify}>
          <FormField className="gap-1.5">
            <FieldLabel className="text-xs" htmlFor="enrollment-code">
              6-digit code
            </FieldLabel>
            <InputOTP
              aria-label="6-digit code"
              autoComplete="one-time-code"
              containerClassName="w-full"
              id="enrollment-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(value) =>
                setCode(value.replace(/\D/g, "").slice(0, 6))
              }
              value={code}
            >
              <InputOTPGroup className="flex-1">
                {[0, 1, 2].map((index) => (
                  <InputOTPSlot
                    className="min-w-0 flex-1"
                    index={index}
                    key={index}
                  />
                ))}
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup className="flex-1">
                {[3, 4, 5].map((index) => (
                  <InputOTPSlot
                    className="min-w-0 flex-1"
                    index={index}
                    key={index}
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </FormField>
          {failure ? <FormError>{failure}</FormError> : null}
          <Button
            className="w-full"
            disabled={pending || code.length !== 6}
            size="sm"
            type="submit"
          >
            {pending ? (
              <Spinner aria-hidden="true" data-icon="inline-start" />
            ) : null}
            {pending ? "Verifying…" : "Verify code"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="gap-4 flex flex-col">
      {hideIntro ? null : (
        <div>
          <h2 className="text-sm font-medium tracking-[-0.01em]">
            Set up authenticator
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Confirm your password, then scan a QR code with your authenticator
            app.
          </p>
        </div>
      )}
      <form className="gap-3 flex flex-col" onSubmit={begin}>
        <div className="gap-1.5 flex flex-col">
          <Label htmlFor="enrollment-password">Current password</Label>
          <PasswordInput
            autoComplete="current-password"
            autoFocus
            id="enrollment-password"
            onChange={(event) => setPassword(event.target.value)}
            value={password}
          />
        </div>
        {failure ? <FormError>{failure}</FormError> : null}
        <div className="gap-2 flex flex-wrap">
          <Button
            className="flex-1"
            disabled={pending || !password}
            size="sm"
            type="submit"
          >
            {pending ? (
              <Spinner aria-hidden="true" data-icon="inline-start" />
            ) : null}
            {pending ? "Starting…" : "Continue"}
          </Button>
          {onCancel ? (
            <Button
              disabled={pending}
              onClick={onCancel}
              size="sm"
              type="button"
              variant="ghost"
            >
              {cancelLabel}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
