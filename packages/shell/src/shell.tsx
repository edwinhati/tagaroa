import { Logo } from "@repo/ui/blocks/logo";
import { ThemeToggle } from "@repo/ui/blocks/theme";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { type ReactNode } from "react";

import { authClient } from "./auth-client";
import type { Domain } from "./domains";
import { ImpersonationNotice } from "./impersonation-notice";
import { ADMIN_URL, signInUrl } from "./session";

/**
 * The chrome every workspace surface wears: who you are, where you can go, and
 * one rule dividing that from the domain's own page. The domains are separate
 * apps behind Turborepo's proxy, so their links are plain anchors — a router
 * navigation would look for a route this app does not have.
 */
export function WorkspaceShell({
  admin = false,
  impersonating = false,
  operator,
  domains,
  current,
  children,
}: {
  /** Whether to offer the admin surface. Hiding it is courtesy, not a gate. */
  admin?: boolean;
  /** Whether the operator is temporarily acting as this person. */
  impersonating?: boolean;
  operator: string;
  /** The domains this person works in — never the whole registry. */
  domains: Domain[];
  /** The slug of the domain being shown, when a domain is showing. */
  current?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-svh grid-rows-[auto_auto_1fr]">
      {impersonating ? <ImpersonationNotice operator={operator} /> : null}
      <header className="gap-4 px-5 py-3.5 lg:px-7 flex items-center justify-between border-b border-border">
        <Logo size={18} />
        <div className="gap-1 min-w-0 flex items-center">
          <span className="px-2 text-xs truncate text-muted-foreground">
            {operator}
          </span>
          {admin ? (
            <a
              className="min-h-11 px-2 py-1 text-xs ease-out inline-flex items-center text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline"
              href={`${ADMIN_URL}/overview`}
            >
              Admin
            </a>
          ) : null}
          <SignOut />
          <ThemeToggle />
        </div>
      </header>

      {domains.length > 0 ? (
        <DomainBar current={current} domains={domains} />
      ) : (
        <div className="border-b border-border" />
      )}

      <main className="px-5 py-8 lg:px-7 lg:py-10">{children}</main>
    </div>
  );
}

/** Unavailable domains remain visible to their members, without a dead link. */
function DomainBar({
  current,
  domains,
}: {
  current?: string;
  domains: Domain[];
}) {
  return (
    <nav aria-label="Domains" className="border-b border-border">
      <ul className="gap-1 px-2 lg:px-4 flex flex-wrap items-stretch">
        {domains.map((domain) => {
          const active = domain.slug === current;
          return (
            <li key={domain.slug} className="flex">
              {domain.live ? (
                <a
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "min-h-11 px-3 py-2.5 text-xs ease-out -mb-px flex items-center border-b border-transparent transition-colors duration-150 outline-none",
                    "focus-visible:border-ring focus-visible:text-foreground",
                    active
                      ? "border-foreground text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  href={`/${domain.slug}`}
                >
                  {domain.label}
                </a>
              ) : (
                <span className="min-h-11 gap-1 px-3 py-2.5 text-xs flex flex-wrap items-center text-muted-foreground">
                  {domain.label}
                  <span>(Coming soon)</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SignOut() {
  return (
    <Button
      data-tone="muted"
      onClick={() => {
        void authClient
          .signOut()
          .finally(() =>
            window.location.assign(signInUrl(window.location.origin)),
          );
      }}
      size="sm"
      variant="ghost"
    >
      Sign out
    </Button>
  );
}
