import { AppTrail, Page } from "@repo/shell/app-shell";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { relativeTime } from "@repo/ui/lib/relative-time";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Failed,
  FIGURE,
  Mark,
  COLLECTION,
  PANEL,
  PanelSkeleton,
} from "../../../components/admin-surface";
import type {
  AuthEvent,
  IdentityIssue,
  VisibleAttentionKind,
} from "../../../lib/admin";
import { dashboardQueryOptions } from "../../../lib/admin";
import { attentionCopy, eventAction } from "../../../lib/identity-operations";

export const Route = createFileRoute("/_shell/identity-access/work-queue")({
  component: WorkQueue,
});

/**
 * Sign-ins are written by the authentication service, not by a person.
 * That label is not an actor on the trail.
 */
const SERVICE_ACTOR = "Authentication service";

/** Kind priority for “next up”: clear recovery risk before domain access gaps. */
const issueOrder: VisibleAttentionKind[] = [
  "unverified-email",
  "no-subsidiary",
];

function WorkQueue() {
  const dashboard = useQuery(dashboardQueryOptions);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  /** One row per person, the longest-waiting first, recovery risk before access gaps. */
  const queue = useMemo(
    () =>
      [...(dashboard.data?.attention ?? [])]
        .filter(
          (issue): issue is IdentityIssue & { kind: VisibleAttentionKind } =>
            issueOrder.includes(issue.kind as VisibleAttentionKind),
        )
        .sort(
          (a, b) =>
            b.ageDays - a.ageDays ||
            issueOrder.indexOf(a.kind) - issueOrder.indexOf(b.kind),
        ),
    [dashboard.data],
  );
  const shown = queue.slice(0, QUEUE_LIMIT);
  const trail = useMemo(
    () => collapseRepeats(dashboard.data?.events ?? []).slice(0, 5),
    [dashboard.data],
  );

  return (
    <Page
      breadcrumb={
        <AppTrail
          items={[
            { label: "Identity & access", to: "/identity-access" },
            { label: "Work queue" },
          ]}
        />
      }
      description={dashboard.data ? queueSummary(queue) : undefined}
      title="Work queue"
    >
      {dashboard.isPending ? (
        <div className={COLLECTION}>
          <Skeleton className="h-9 max-w-xl" />
          <PanelSkeleton rows={4} />
        </div>
      ) : dashboard.isError ? (
        <Failed
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
          what="work queue"
        />
      ) : (
        <div className="gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] grid items-start">
          <section aria-labelledby="work-queue-needs" className={PANEL}>
            <div className="gap-3 px-4 py-3.5 flex items-baseline justify-between">
              <h2
                className="text-sm font-medium tracking-[-0.02em]"
                id="work-queue-needs"
              >
                Needs a person
              </h2>
              {queue.length > 0 ? (
                <span className={`${FIGURE} text-muted-foreground`}>
                  Oldest first
                </span>
              ) : null}
            </div>

            {queue.length === 0 ? (
              <div className="px-4 pb-6 pt-2 border-t border-border">
                <p className="font-medium text-[13px]">
                  Nothing needs a person
                </p>
                <p className="mt-1 max-w-[48ch] text-[12.5px] text-pretty text-muted-foreground">
                  Every active person has verified email and domain access.
                </p>
              </div>
            ) : (
              <ul>
                {shown.map((issue, index) => (
                  <QueueRow
                    issue={issue}
                    key={`${issue.kind}:${issue.userId}`}
                    primary={index === 0}
                  />
                ))}
              </ul>
            )}

            {queue.length > shown.length ? (
              <div className="px-4 py-2.5 border-t border-border text-[12.5px] text-muted-foreground">
                {queue.length - shown.length} more waiting ·{" "}
                <Link
                  className="text-foreground underline-offset-4 hover:underline"
                  to="/identity-access/people"
                >
                  Open People
                </Link>
              </div>
            ) : null}

            <div className="gap-3 px-4 py-2.5 flex items-center justify-between border-t border-border text-[12.5px] text-muted-foreground">
              <span>
                Privileged review this week:{" "}
                <span className={`${FIGURE} text-foreground`}>
                  {dashboard.data.accessReview.reviewed} of{" "}
                  {dashboard.data.accessReview.total}
                </span>{" "}
                confirmed
              </span>
              <Link
                className="text-foreground underline-offset-4 hover:underline"
                to="/identity-access/reviews"
              >
                Open reviews
              </Link>
            </div>
          </section>

          <section aria-labelledby="work-queue-recent" className={PANEL}>
            <form
              className="gap-2 px-4 py-3 flex items-center border-b border-border"
              onSubmit={(event) => {
                event.preventDefault();
                const value = query.trim();
                if (value) {
                  void navigate({
                    search: { q: value },
                    to: "/identity-access/people",
                  });
                }
              }}
            >
              <SearchIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
                strokeWidth={1.5}
              />
              <Input
                aria-label="Find a person or access problem"
                className="h-7"
                data-bare
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a person…"
                value={query}
              />
            </form>

            <div className="px-4 pt-3 pb-1 gap-3 flex items-baseline justify-between">
              <h2 className="font-medium text-[12.5px]" id="work-queue-recent">
                Recent activity
              </h2>
              <Link
                className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
                to="/identity-access/activity"
              >
                View all
              </Link>
            </div>
            {trail.length === 0 ? (
              <p className="px-4 pt-1 pb-3 text-[12.5px] text-muted-foreground">
                No recent activity.
              </p>
            ) : (
              <ul className="pb-1">
                {trail.map(({ event, times }) => {
                  const lines = trailLines(event);
                  const secondary =
                    times > 1
                      ? `${lines.secondary ?? ""}${lines.secondary ? " · " : ""}${times} times`
                      : lines.secondary;
                  return (
                    <li
                      className="row-hover-bg gap-x-3 px-4 py-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline"
                      key={event.id}
                    >
                      <p className="min-w-0 truncate text-[13px]">
                        {lines.primary}
                      </p>
                      <time
                        className={`${FIGURE} min-w-[5.75rem] shrink-0 text-right text-muted-foreground`}
                        dateTime={new Date(event.at).toISOString()}
                        title={new Date(event.at).toLocaleString()}
                      >
                        {relativeTime(event.at)}
                      </time>
                      {secondary ? (
                        <p className="min-w-0 truncate text-[12.5px] text-muted-foreground">
                          {secondary}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}

/** Rows the queue lists before handing the rest to People. */
const QUEUE_LIMIT = 8;

function queueSummary(queue: IdentityIssue[]) {
  if (queue.length === 0) return "Nothing needs a person right now.";
  const oldest = queue[0]?.ageDays ?? 0;
  const count =
    queue.length === 1 ? "1 thing needs" : `${queue.length} things need`;
  const wait =
    oldest === 0
      ? "The oldest arrived today."
      : `The oldest has waited ${oldest === 1 ? "1 day" : `${oldest} days`}.`;
  return `${count} a person. ${wait}`;
}

/**
 * The trail repeats itself when one person signs in several times in a row;
 * a run of lines that would read the same is shown once, with a count.
 */
function collapseRepeats(events: AuthEvent[]) {
  const runs: { event: AuthEvent; times: number }[] = [];
  for (const event of events) {
    const last = runs.at(-1);
    const lines = trailLines(event);
    const previous = last ? trailLines(last.event) : null;
    if (
      previous &&
      last &&
      previous.primary === lines.primary &&
      previous.secondary === lines.secondary
    ) {
      last.times += 1;
    } else {
      runs.push({ event, times: 1 });
    }
  }
  return runs;
}

/**
 * Target on the first line, the act on the second. A trailing preposition
 * is dropped once the address has its own line, so the verb does not dangle.
 * The shared phrases still end in "for" / "to" / "from" for the other pages.
 */
function trailLines(event: AuthEvent): {
  primary: string;
  secondary: string | null;
} {
  const phrase = eventAction(event);
  const actor =
    event.actor && event.actor !== SERVICE_ACTOR && event.actor !== event.target
      ? event.actor
      : null;

  if (!event.target) {
    return { primary: phrase, secondary: actor };
  }

  const verb = phrase.replace(/ (?:for|to|from)$/, "");
  return {
    primary: event.target,
    secondary: actor ? `${verb} · ${actor}` : verb,
  };
}

function QueueRow({
  issue,
  primary,
}: {
  issue: IdentityIssue & { kind: VisibleAttentionKind };
  primary: boolean;
}) {
  const copy = attentionCopy[issue.kind];
  const who = issue.name || issue.email;
  const waited =
    issue.ageDays === 0
      ? "arrived today"
      : `waiting ${issue.ageDays === 1 ? "1 day" : `${issue.ageDays} days`}`;

  return (
    <li className="row-hover-bg gap-3 px-4 py-3 sm:flex-row sm:items-center flex flex-col border-t border-border">
      <div className="gap-3 min-w-0 flex flex-1 items-center">
        <Avatar size="sm">
          <AvatarFallback>{who.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="gap-x-3 gap-y-0.5 flex flex-wrap items-center">
            <span className="font-medium truncate text-[13px]">{who}</span>
            <Mark className="text-[12.5px]" label={copy.title} tone="warn" />
          </div>
          <p className="mt-0.5 text-[12.5px] text-pretty text-muted-foreground">
            {copy.consequence} · {waited}
          </p>
        </div>
      </div>
      <Button
        aria-label={`${copy.action}: ${who}`}
        className="sm:shrink-0 sm:self-auto self-start"
        nativeButton={false}
        render={
          <Link
            params={{ personId: issue.userId }}
            to="/identity-access/people/$personId"
          />
        }
        size="sm"
        variant={primary ? "default" : "outline"}
      >
        {copy.action}
      </Button>
    </li>
  );
}
