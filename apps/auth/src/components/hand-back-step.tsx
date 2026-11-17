import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { useEffect, useRef, useState } from "react";

import { finishOAuth } from "../lib/oauth";
import { AuthShell, FormError, Panel, ScreenHeading } from "./auth-shell";

/**
 * The last step when another app (NetBird) sent the person here: back to it,
 * signed in. Core answers with that app's address and the browser follows.
 */
export function HandBackStep({ query }: { query: string }) {
  const [failure, setFailure] = useState<string | undefined>();
  // Each attempt spends an authorization code; StrictMode runs effects twice.
  const started = useRef(false);

  async function handBack() {
    setFailure(undefined);
    setFailure(await finishOAuth(query));
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void handBack();
  });

  return (
    <AuthShell>
      <ScreenHeading focusOnMount title="Signing you in">
        Taking you back to the app that sent you here.
      </ScreenHeading>
      <Panel>
        {failure ? (
          <div className="gap-3 flex flex-col">
            <FormError>{failure}</FormError>
            <Button onClick={() => void handBack()} size="sm" type="button">
              Try again
            </Button>
          </div>
        ) : (
          <div
            className="gap-2 py-4 text-sm flex items-center text-muted-foreground"
            role="status"
          >
            <Spinner aria-hidden="true" data-icon="inline-start" />
            Returning you to the app…
          </div>
        )}
      </Panel>
    </AuthShell>
  );
}
