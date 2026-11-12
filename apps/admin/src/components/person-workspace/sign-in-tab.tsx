import { type AuthSession } from "@repo/shell/create-auth-client";
import { parseUserAgent } from "@repo/shell/session-device";
import { SessionDeviceMarks } from "@repo/shell/session-device-mark";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { relativeTime } from "@repo/ui/lib/relative-time";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode } from "react";

import { announce } from "../../lib/api";
import { dashboardQueryOptions } from "../../lib/directory";
import {
  type Person,
  accessPolicyQueryOptions,
  linkedAccountsQueryOptions,
  personSessionsQueryOptions,
  revokeSession,
} from "../../lib/people";
import { FIGURE, MONO, PANEL } from "../admin-surface";
import { MutedLine, Row } from "./tab-row";

export function SignInTab({
  canRevoke,
  person,
}: {
  canRevoke: boolean;
  person: Person;
}) {
  const queryClient = useQueryClient();
  const sessions = useQuery(personSessionsQueryOptions(person.id));
  const accounts = useQuery(linkedAccountsQueryOptions(person.id));
  const revoke = useMutation({
    mutationFn: revokeSession,
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`Session revoked for ${person.email}`);
      void queryClient.invalidateQueries({
        queryKey: personSessionsQueryOptions(person.id).queryKey,
      });
    },
  });

  return (
    <div className={PANEL}>
      <Row
        title="Active sessions"
        trailing={
          sessions.data ? (
            <span className="text-muted-foreground">
              <SessionCount count={sessions.data.length} />
            </span>
          ) : null
        }
      >
        {sessions.isPending ? (
          <div className="mt-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-3 grid">
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
          </div>
        ) : sessions.isError ? (
          <p className="mt-1.5 text-xs text-destructive">
            {sessions.error.message}
          </p>
        ) : sessions.data.length === 0 ? (
          <MutedLine>No active sessions.</MutedLine>
        ) : (
          <ul className="mt-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-3 grid">
            {sessions.data.map((session) => (
              <SessionCard
                canRevoke={canRevoke}
                key={session.id}
                pending={revoke.isPending}
                session={session}
                onRevoke={() => revoke.mutate(session.id)}
              />
            ))}
          </ul>
        )}
      </Row>
      <Row title="Linked accounts">
        {accounts.isPending ? (
          <Skeleton className="mt-2 h-8" />
        ) : accounts.isError ? (
          <p className="mt-1.5 text-xs text-destructive">
            {accounts.error.message}
          </p>
        ) : accounts.data.length === 0 ? (
          <MutedLine>No linked accounts.</MutedLine>
        ) : (
          <ul className="mt-1.5 flex flex-col">
            {accounts.data.map((account) => (
              <li
                className="gap-3 py-1.5 sm:grid-cols-[minmax(8rem,auto)_minmax(0,1fr)_auto] sm:items-baseline grid"
                key={account.id}
              >
                <p className="font-medium text-[13px] capitalize">
                  {account.providerId}
                </p>
                <p className={`${MONO} truncate text-muted-foreground`}>
                  {account.accountId}
                </p>
                <time className={`${FIGURE} text-muted-foreground`}>
                  Linked {new Date(account.createdAt).toLocaleDateString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Row>
    </div>
  );
}

export function SignInSummary({ person }: { person: Person }) {
  const sessions = useQuery(personSessionsQueryOptions(person.id));
  const dashboard = useQuery(dashboardQueryOptions);
  const health = dashboard.data?.people.find(
    (entry) => entry.userId === person.id,
  );

  return (
    <aside aria-label="Sign-in summary" className={`${PANEL} lg:mt-11 px-4`}>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] text-[13px]">
        <SummaryFact label="Two-factor">
          {person.twoFactorEnabled ? "On" : "Not set up"}
        </SummaryFact>
        <SummaryFact label="Password">
          {person.mustChangePassword ? "Temporary" : "Current"}
        </SummaryFact>
        <SummaryFact label="Email">
          {person.emailVerified ? "Verified" : "Not verified"}
        </SummaryFact>
        <SummaryFact label="Sessions">
          {sessions.data ? (
            <SessionCount count={sessions.data.length} />
          ) : sessions.isError ? (
            <span
              className="text-muted-foreground"
              title={sessions.error.message}
            >
              Unavailable
            </span>
          ) : (
            <Skeleton className="h-3.5 w-10" />
          )}
        </SummaryFact>
        <SummaryFact label="Last active">
          <span className={FIGURE}>
            {health?.lastActiveAt ? relativeTime(health.lastActiveAt) : "Never"}
          </span>
        </SummaryFact>
      </dl>
    </aside>
  );
}

/** How many sessions a person holds, against the limit once it is known. */
function SessionCount({ count }: { count: number }) {
  const limit = useQuery(accessPolicyQueryOptions).data?.session
    .concurrentLimit;
  return (
    <span className={FIGURE}>
      {count}
      {limit === undefined ? "" : ` of ${limit}`}
    </span>
  );
}

function SummaryFact({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <>
      <dt className="py-2.5 border-t border-border text-muted-foreground first:border-t-0">
        {label}
      </dt>
      <dd className="py-2.5 flex items-center justify-end border-t border-border [dt:first-child+&]:border-t-0">
        {children}
      </dd>
    </>
  );
}

function SessionCard({
  canRevoke,
  onRevoke,
  pending,
  session,
}: {
  canRevoke: boolean;
  onRevoke: () => void;
  pending: boolean;
  session: AuthSession;
}) {
  const parsed = parseUserAgent(session.userAgent);
  const ip = session.ipAddress?.trim() || "Unknown IP";

  return (
    <li className="ease-out flex overflow-hidden rounded-md border border-border/70 bg-muted/20 transition-colors duration-150 hover:bg-muted/35">
      <div className="min-w-0 gap-0.5 px-2.5 py-1.5 flex flex-1 flex-col">
        <div className="gap-1.5 min-w-0 flex items-center">
          <SessionDeviceMarks
            browser={parsed.browser}
            platform={parsed.platform}
          />
          <p
            className="min-w-0 font-medium flex-1 truncate text-[11.5px] leading-none"
            title={session.userAgent || undefined}
          >
            {parsed.label}
          </p>
        </div>
        <p className="leading-snug truncate text-[10.5px] text-muted-foreground">
          <span className="font-mono">{ip}</span>
          <span className="mx-1.5 text-border">·</span>
          <span className={`${FIGURE} text-[10.5px]`}>
            {relativeTime(session.updatedAt)}
          </span>
        </p>
      </div>
      {canRevoke ? (
        <div className="px-1.5 flex items-center justify-center border-l border-border/70 bg-muted/35">
          <Button
            disabled={pending}
            onClick={onRevoke}
            size="xs"
            type="button"
            variant="ghost"
          >
            Revoke
          </Button>
        </div>
      ) : null}
    </li>
  );
}
