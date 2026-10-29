import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { postSignInTarget } from "../lib/auth-client";
import { sessionQueryOptions } from "../lib/session";
import { SignInStep, TwoFactorStep } from "./index";

export const Route = createFileRoute("/reauth")({
  head: () => ({ meta: [{ title: "Confirm it’s you · Tagaroa" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    const session =
      await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session?.user?.id || !session.user.email) {
      throw redirect({ to: "/", search: { redirect: search.redirect } });
    }
    return { email: session.user.email };
  },
  component: Reauthenticate,
});

function Reauthenticate() {
  const { redirect: returnTo } = Route.useSearch();
  const { email } = Route.useRouteContext();
  const [step, setStep] = useState<"sign-in" | "two-factor">("sign-in");
  const finish = () => window.location.assign(postSignInTarget(returnTo));

  if (step === "two-factor") return <TwoFactorStep onDone={finish} />;

  return (
    <SignInStep
      actionLabel="Confirm and continue"
      description="Sign in again, then retry the sensitive action."
      emailReadOnly
      heading="Confirm it’s you"
      initialEmail={email}
      onDone={finish}
      onTemporaryPassword={() =>
        window.location.assign(postSignInTarget(returnTo))
      }
      onTwoFactor={() => setStep("two-factor")}
      pendingLabel="Confirming…"
      showPasskey={false}
    />
  );
}
