import { createFileRoute, Link } from "@tanstack/react-router";

import {
  Aside,
  AuthShell,
  Panel,
  ScreenHeading,
} from "../components/auth-shell";

export const Route = createFileRoute("/locked-out")({
  head: () => ({ meta: [{ title: "Locked out · Tagaroa" }] }),
  component: LockedOut,
});

const STEPS = [
  "Message an admin of your organization — in person, by phone, however you normally reach them.",
  "They confirm it's you and set a new password on your account.",
  "Sign in with it, then change it to something only you know.",
] as const;

function LockedOut() {
  return (
    <AuthShell>
      <ScreenHeading title="Locked out?">
        An admin restores access. The workspace doesn't send password emails.
      </ScreenHeading>

      <Panel>
        <ol className="gap-3.5 grid">
          {STEPS.map((step, index) => (
            <li className="gap-3 flex" key={step}>
              <span
                aria-hidden="true"
                className="tabular size-5 mt-px grid shrink-0 place-items-center rounded-full border border-border text-[0.775rem] text-muted-foreground"
              >
                {index + 1}
              </span>
              <span className="leading-relaxed text-[0.8125rem]">{step}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <Aside>
        <Link
          viewTransition
          to="/"
          search={{ redirect: undefined }}
          className="hover:text-sea underline"
        >
          Back to sign in
        </Link>
      </Aside>
    </AuthShell>
  );
}
