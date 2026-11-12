import { AuthenticatorSetupFlow } from "@repo/shell/account-security-totp";

import { authClient } from "../lib/auth-client";
import { AuthShell, Panel, ScreenHeading } from "./auth-shell";

/**
 * First-sign-in authenticator enrollment for privileged roles. Ongoing
 * security management lives in the workspace Account settings dialog.
 */
export function SecureAccountStep({
  completionLabel = "Continue to workspace",
  onDone,
}: {
  completionLabel?: string;
  onDone: () => void;
}) {
  return (
    <AuthShell>
      <ScreenHeading focusOnMount title="Secure your account">
        Set up an authenticator and save your recovery codes.
      </ScreenHeading>
      <Panel>
        <AuthenticatorSetupFlow
          client={authClient}
          completionLabel={completionLabel}
          hideIntro
          onDone={onDone}
        />
      </Panel>
    </AuthShell>
  );
}
