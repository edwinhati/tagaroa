import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import {
  AuthenticatorSetupFlow,
  FormError,
  RecoveryCodesFlow,
} from "./account-security-totp";
import { authCall } from "./attempt-auth";
import { authClient } from "./auth-client";
import { sessionQueryOptions } from "./session";

type SecurityTask = "setup-authenticator" | "replace-recovery-codes" | null;

export function SettingsGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg bg-muted/45 ring-1 ring-foreground/6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A settings block still reading: placeholders under one spoken label. */
export function SettingsLoading({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <SettingsGroup>
      <div className="gap-3 p-3.5 flex flex-col" role="status">
        <span className="sr-only">{label}</span>
        {children}
      </div>
    </SettingsGroup>
  );
}

/** A settings block whose read failed, with the way to read it again. */
export function SettingsRetry({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <SettingsGroup>
      <div className="gap-3 p-3.5 flex flex-col">
        <p className="text-[0.8125rem] text-destructive" role="alert">
          {error.message}
        </p>
        <Button
          className="self-start"
          onClick={onRetry}
          size="sm"
          type="button"
          variant="outline"
        >
          Try again
        </Button>
      </div>
    </SettingsGroup>
  );
}

export function AccountSecurityPanel({
  onTwoFactorChange,
  twoFactorEnabled,
}: {
  onTwoFactorChange?: (enabled: boolean) => void;
  twoFactorEnabled: boolean;
}) {
  const queryClient = useQueryClient();
  const [securityTask, setSecurityTask] = useState<SecurityTask>(null);
  const [enabled, setEnabled] = useState(twoFactorEnabled);
  const [previousEnabled, setPreviousEnabled] = useState(twoFactorEnabled);

  if (previousEnabled !== twoFactorEnabled) {
    setPreviousEnabled(twoFactorEnabled);
    setEnabled(twoFactorEnabled);
  }

  function finishAuthenticatorSetup() {
    setEnabled(true);
    onTwoFactorChange?.(true);
    setSecurityTask(null);
    void queryClient.invalidateQueries({
      queryKey: sessionQueryOptions.queryKey,
    });
  }

  if (securityTask === "setup-authenticator") {
    return (
      <AuthenticatorSetupFlow
        client={authClient}
        completionLabel="Back to security"
        onCancel={() => setSecurityTask(null)}
        onDone={finishAuthenticatorSetup}
      />
    );
  }

  if (securityTask === "replace-recovery-codes") {
    return (
      <RecoveryCodesFlow
        client={authClient}
        completionLabel="Back to security"
        onCancel={() => setSecurityTask(null)}
        onDone={() => setSecurityTask(null)}
      />
    );
  }

  return (
    <div className="gap-3 flex flex-col">
      <SettingsGroup>
        <div className="gap-3 px-3.5 py-3.5 flex items-center justify-between">
          <div className="min-w-0">
            <p
              className="text-sm font-medium leading-snug"
              id="authenticator-heading"
            >
              Authenticator
            </p>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              {enabled ? "Set up" : "Required for privileged access"}
            </p>
          </div>
          <Button
            aria-label={enabled ? "Recovery codes" : "Set up authenticator"}
            className="shrink-0"
            onClick={() =>
              setSecurityTask(
                enabled ? "replace-recovery-codes" : "setup-authenticator",
              )
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {enabled ? "Recovery codes" : "Set up"}
          </Button>
        </div>
      </SettingsGroup>
      <PasskeysSection />
    </div>
  );
}

const PASSKEYS_QUERY_KEY = ["account", "passkeys"];

function PasskeysSection() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [passkeyMessage, setPasskeyMessage] = useState("");
  const [passkeyToRemove, setPasskeyToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const passkeys = useQuery({
    queryKey: PASSKEYS_QUERY_KEY,
    queryFn: async () =>
      (await authCall(
        () => authClient.passkey.listUserPasskeys(),
        "Could not load passkeys. Check your connection and try again.",
      )) ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.passkey.addPasskey({
        name: name.trim() || "My passkey",
      });
      if (error) {
        const code = "code" in error ? error.code : undefined;
        throw new Error(
          code === "ERROR_CEREMONY_ABORTED" ||
            code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY"
            ? "Passkey setup was canceled or timed out. Try again and complete your device’s prompt."
            : error.message ||
                "Could not add the passkey. Complete the device prompt and try again.",
        );
      }
    },
    onMutate: () => setPasskeyMessage(""),
    onSuccess: () => {
      setName("");
      setPasskeyMessage("Passkey added.");
      void queryClient.invalidateQueries({ queryKey: PASSKEYS_QUERY_KEY });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      authCall(
        () => authClient.passkey.deletePasskey({ id }),
        "Could not remove the passkey. Try again.",
      ),
    onSuccess: () => {
      setPasskeyToRemove(null);
      setPasskeyMessage("Passkey removed.");
      return queryClient.invalidateQueries({ queryKey: PASSKEYS_QUERY_KEY });
    },
  });

  return (
    <section aria-labelledby="passkeys-heading" className="gap-2 flex flex-col">
      <div className="px-0.5 gap-3 flex items-baseline justify-between">
        <h3
          className="font-medium text-[0.8125rem] text-muted-foreground"
          id="passkeys-heading"
        >
          Passkeys
        </h3>
      </div>

      {passkeys.isPending ? (
        <SettingsLoading label="Loading passkeys…">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </SettingsLoading>
      ) : passkeys.data?.length ? (
        <ul>
          <SettingsGroup>
            {passkeys.data.map((passkey) => (
              <li
                className="gap-2 px-3.5 py-3 flex items-center justify-between border-b border-border/70 last:border-b-0"
                key={passkey.id}
              >
                <span className="min-w-0 text-sm truncate">
                  {passkey.name || "Unnamed passkey"}
                </span>
                <Button
                  aria-label={`Remove ${passkey.name || "unnamed passkey"}`}
                  className="shrink-0"
                  disabled={remove.isPending}
                  onClick={() => {
                    remove.reset();
                    setPasskeyMessage("");
                    setPasskeyToRemove({
                      id: passkey.id,
                      name: passkey.name || "Unnamed passkey",
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              </li>
            ))}
          </SettingsGroup>
        </ul>
      ) : null}

      {passkeys.isError ? (
        <FormError>{passkeys.error.message}</FormError>
      ) : null}

      {passkeyMessage ? (
        <p
          aria-live="polite"
          className="px-0.5 text-[0.8125rem] text-muted-foreground"
          role="status"
        >
          {passkeyMessage}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <SettingsGroup className="p-3.5">
          {passkeys.isSuccess && !passkeys.data?.length ? (
            <p className="mb-3 text-[0.8125rem] text-muted-foreground">
              None yet. Name this device to add one.
            </p>
          ) : null}
          <div className="gap-1.5 flex flex-col">
            <Label htmlFor="passkey-name">
              New passkey name{" "}
              <span className="font-normal text-muted-foreground">
                Optional
              </span>
            </Label>
            <Input
              autoComplete="off"
              id="passkey-name"
              name="passkey-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Work laptop…"
              spellCheck={false}
              value={name}
            />
          </div>
          {add.isError ? (
            <div className="mt-3">
              <FormError>{add.error.message}</FormError>
            </div>
          ) : null}
          <Button
            className="mt-3 self-start"
            disabled={add.isPending}
            size="sm"
            type="submit"
          >
            {add.isPending ? (
              <Spinner aria-hidden="true" data-icon="inline-start" />
            ) : null}
            {add.isPending ? "Waiting for device…" : "Add passkey"}
          </Button>
        </SettingsGroup>
      </form>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !remove.isPending) {
            setPasskeyToRemove(null);
            remove.reset();
          }
        }}
        open={passkeyToRemove !== null}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this passkey?</AlertDialogTitle>
            <AlertDialogDescription>
              {passkeyToRemove?.name} will stop working for sign-in. Other
              passkeys and your password will still work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {remove.isError ? (
            <FormError>{remove.error.message}</FormError>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Keep passkey
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => {
                if (passkeyToRemove) remove.mutate(passkeyToRemove.id);
              }}
              variant="destructive"
            >
              {remove.isPending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : null}
              {remove.isPending ? "Removing…" : "Remove passkey"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
