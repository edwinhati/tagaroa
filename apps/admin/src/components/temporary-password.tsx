import { Button } from "@repo/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { accessPolicyQueryOptions } from "../lib/people";
import { PANEL } from "./admin-surface";

/**
 * The platform CSPRNG makes 22 characters of base64url. That clears the core
 * service's 12-character floor and is never a word anyone could guess from
 * knowing the company.
 */
export function createTemporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** A credential shown once, with an explicit clipboard failure state. */
export function TemporaryPassword({ password }: { password: string }) {
  const policy = useQuery(accessPolicyQueryOptions);
  const [state, setState] = useState<"idle" | "copied" | "refused">("idle");

  const copy = () => {
    void navigator.clipboard
      ?.writeText(password)
      .then(
        () => setState("copied"),
        () => setState("refused"),
      )
      .catch(() => setState("refused"))
      .finally(() => setTimeout(() => setState("idle"), 4000));
  };

  return (
    <div className="gap-2 flex flex-col">
      <div className={`${PANEL} gap-2 p-1 pl-3 flex items-center`}>
        <p className="min-w-0 font-mono flex-1 text-[0.8125rem] break-all select-all">
          {password}
        </p>
        <Button
          aria-label={
            state === "copied"
              ? "Password copied"
              : state === "refused"
                ? "Copying was refused; select the password"
                : "Copy the password"
          }
          className="shrink-0"
          onClick={copy}
          size="sm"
          variant="ghost"
        >
          {state === "copied" ? (
            <CheckIcon aria-hidden="true" strokeWidth={1.5} />
          ) : (
            <CopyIcon aria-hidden="true" strokeWidth={1.5} />
          )}
          {state === "copied"
            ? "Copied"
            : state === "refused"
              ? "Select it"
              : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {policy.data
          ? `Expires ${policy.data.session.temporaryPasswordHours} hours after issue. Must be replaced at first sign-in.`
          : policy.isError
            ? "Expiry information is unavailable. Must be replaced at first sign-in."
            : "Reading password expiry…"}
      </p>
    </div>
  );
}
