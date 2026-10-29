import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { useState } from "react";
import { createPortal } from "react-dom";

import { authClient } from "./auth-client";
import { WORKSPACE_URL } from "./session";

/**
 * Persistent bottom-right notice while an admin is signed in as someone else.
 * Not a dismissible toast: it stays until they return to their own account.
 * Shared by AppShell and WorkspaceShell.
 */
export function ImpersonationNotice({ operator }: { operator: string }) {
  const [error, setError] = useState("");
  const [stopping, setStopping] = useState(false);

  const stop = async () => {
    setError("");
    setStopping(true);
    const result = await authClient.admin.stopImpersonating();
    if (result.error) {
      setError(result.error.message || "Could not stop impersonating.");
      setStopping(false);
      return;
    }
    window.location.assign(WORKSPACE_URL);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-live="polite"
      className={cn(
        "right-4 bottom-4 fixed z-40 w-[min(17.5rem,calc(100%-2rem))]",
        "gap-3 p-3 flex flex-col",
        "rounded-[var(--panel-radius)] border border-status-warning-line bg-card",
        "text-card-foreground shadow-[var(--panel-shadow)]",
        "motion-safe:ease-out motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
      )}
      role="status"
    >
      <div className="gap-2 min-w-0 flex flex-col">
        <Badge data-status="warning" variant="outline">
          Impersonating
        </Badge>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" title={operator}>
            {operator}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            You are signed in as this person. Stop to return to your account.
          </p>
          {error ? (
            <p className="mt-1.5 text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <Button
        aria-label={
          stopping
            ? "Returning to your account"
            : "Stop impersonating and return to your account"
        }
        className="w-full"
        disabled={stopping}
        onClick={() => void stop()}
        size="sm"
        variant="outline"
      >
        {stopping ? "Returning…" : "Return to your account"}
      </Button>
    </div>,
    document.body,
  );
}
