import { createFileRoute, Link } from "@tanstack/react-router";

import {
  Aside,
  AuthShell,
  Panel,
  ScreenHeading,
} from "../components/auth-shell";

/**
 * Two ways to be outside, one page.
 *
 * They share a door and an answer — an identity administrator puts you back in
 * — but not the steps. Someone who has forgotten a password needs a new one.
 * Someone whose access was suspended does not: handing them password
 * instructions sends them to an administrator asking for the wrong thing.
 */
type Reason = "expired" | "forgotten" | "suspended";

const SCREENS: Record<
  Reason,
  { heading: string; lede: string; steps: readonly string[] }
> = {
  expired: {
    heading: "Temporary password expired",
    lede: "An identity administrator must issue a new temporary password before you can continue.",
    steps: [
      "Contact an identity administrator through your usual trusted channel.",
      "They confirm it’s you and issue a new temporary password.",
      "Sign in and replace it within 24 hours.",
    ],
  },
  forgotten: {
    heading: "Forgot your password?",
    lede: "Password resets require an identity administrator.",
    steps: [
      "Contact an identity administrator through your usual trusted channel.",
      "They verify your identity and issue a temporary password.",
      "Sign in and replace it within 24 hours.",
    ],
  },
  suspended: {
    heading: "Access suspended",
    lede: "An identity administrator has suspended this account. Changing the password will not restore access.",
    steps: [
      "Contact an identity administrator through your usual trusted channel.",
      "They decide whether to restore the account.",
      "If access is restored, sign in with your existing password.",
    ],
  },
};

export const Route = createFileRoute("/locked-out")({
  head: () => ({ meta: [{ title: "Locked out · Tagaroa" }] }),
  // The key is absent rather than undefined when there is no reason, so a plain
  // <Link to="/locked-out"> stays a plain link.
  validateSearch: (
    search: Record<string, unknown>,
  ): { reason?: "expired" | "suspended" } =>
    search.reason === "suspended" || search.reason === "expired"
      ? { reason: search.reason }
      : {},
  component: LockedOut,
});

function LockedOut() {
  const { reason } = Route.useSearch();
  const screen =
    reason === "expired"
      ? SCREENS.expired
      : reason === "suspended"
        ? SCREENS.suspended
        : SCREENS.forgotten;

  return (
    <AuthShell>
      <ScreenHeading title={screen.heading}>{screen.lede}</ScreenHeading>

      <Panel>
        <ol className="gap-3.5 grid">
          {screen.steps.map((step, index) => (
            <li className="gap-3 flex" key={step}>
              <span
                aria-hidden="true"
                className="tabular size-5 text-2xs mt-px grid shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
              >
                {index + 1}
              </span>
              <span className="leading-relaxed text-xs text-pretty">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      <Aside>
        <Link
          viewTransition
          to="/"
          search={{ redirect: undefined }}
          className="underline hover:text-[color:var(--sea)]"
        >
          Back to sign in
        </Link>
      </Aside>
    </AuthShell>
  );
}
