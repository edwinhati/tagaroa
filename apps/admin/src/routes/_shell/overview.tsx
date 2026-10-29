import { AppTrail, Page } from "@repo/shell/app-shell";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";

import {
  Failed,
  FIGURE,
  Mark,
  COLLECTION,
  PANEL,
  PanelSkeleton,
} from "../../components/admin-surface";
import type {
  AuthEvent,
  IdentityIssue,
  VisibleAttentionKind,
} from "../../lib/admin";
import { dashboardQueryOptions } from "../../lib/admin";
import {
  attentionCopy,
  eventAction,
  relativeTime,
} from "../../lib/identity-operations";

export const Route = createFileRoute("/_shell/overview")({
  beforeLoad: () => {
    throw redirect({ to: "/identity-access/work-queue" });
  },
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

export function WorkQueue() {
  const dashboard = useQuery(dashboardQueryOptions);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const issueGroups = useMemo(
    () =>
      issueOrder.flatMap((kind) => {
        const issues = dashboard.data?.attention.filter(
          (issue) => issue.kind === kind,
        );
        if (!issues?.length) return [];
        return [{ kind, issues }];
      }),
    [dashboard.data],
  );
  const issueCount = issueGroups.reduce(
    (total, group) => total + group.issues.length,
    0,
  );
  const [nextGroup, ...otherGroups] = issueGroups;

  return (
    <Page
      actions={
        <Button
          nativeButton={false}
          render={<Link to="/identity-access/reviews" />}
          size="sm"
        >
          Review privileged access
        </Button>
      }
      breadcrumb={
        <AppTrail
          items={[
            { label: "Identity & access", to: "/identity-access" },
            { label: "Work queue" },
          ]}
        />
      }
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
        <div className={COLLECTION}>
          <div className={`${PANEL} work-queue`}>
            <div className="work-queue-attention flex flex-col">
              <span aria-hidden="true" className="work-queue-rail" />
              <div className="work-queue-attention-body gap-3 px-4 py-3.5 flex flex-col">
                <div className="gap-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-medium tracking-[-0.02em]">
                    Next up
                  </h2>
                  <Mark
                    className="text-[12.5px]"
                    label={
                      issueCount === 1 ? "1 issue" : `${issueCount} issues`
                    }
                    tone={issueCount > 0 ? "warn" : "done"}
                  />
                </div>

                {nextGroup ? (
                  <div className="work-queue-callout gap-3 px-3 py-3 sm:flex-row sm:items-center flex flex-col rounded-md border border-border/70 bg-card/60">
                    <NextUpCalloutBody
                      issues={nextGroup.issues}
                      kind={nextGroup.kind}
                    />
                  </div>
                ) : (
                  <div className="px-1 py-6 text-center">
                    <p className="font-medium text-[13px] text-balance">
                      Nothing needs attention
                    </p>
                    <p className="mt-1.5 leading-relaxed mx-auto max-w-[48ch] text-[12.5px] text-pretty text-muted-foreground">
                      Every active person has verified email and domain access.
                    </p>
                  </div>
                )}

                {otherGroups.length > 0 ? (
                  <ul className="gap-0.5 flex flex-col">
                    {otherGroups.map(({ kind, issues }) => (
                      <IssueRow issues={issues} key={kind} kind={kind} />
                    ))}
                  </ul>
                ) : null}

                <div className="gap-1.5 flex flex-col">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-muted-foreground">
                      Privileged review
                    </span>
                    <span className={`${FIGURE} text-muted-foreground`}>
                      {dashboard.data.accessReview.reviewed}/
                      {dashboard.data.accessReview.total} done
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="work-queue-progress"
                    style={
                      {
                        "--work-queue-progress":
                          dashboard.data.accessReview.total > 0
                            ? dashboard.data.accessReview.reviewed /
                              dashboard.data.accessReview.total
                            : 0,
                      } as CSSProperties
                    }
                  >
                    <span />
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-0 flex flex-col">
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
                <h2 className="font-medium text-[12.5px]">Recent</h2>
                <Link
                  className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
                  to="/identity-access/activity"
                >
                  View all
                </Link>
              </div>
              {dashboard.data.events.length === 0 ? (
                <p className="px-4 pt-1 pb-3 text-[12.5px] text-muted-foreground">
                  No recent activity.
                </p>
              ) : (
                <ul className="pb-1">
                  {dashboard.data.events.slice(0, 5).map((event) => {
                    const trail = trailLines(event);
                    return (
                      <li
                        className="work-queue-row row-hover-bg gap-x-3 px-4 py-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline"
                        key={event.id}
                      >
                        <p className="min-w-0 truncate text-[13px]">
                          {trail.primary}
                        </p>
                        <time
                          className={`${FIGURE} min-w-[5.75rem] shrink-0 text-right text-muted-foreground`}
                          dateTime={new Date(event.at).toISOString()}
                          title={new Date(event.at).toLocaleString()}
                        >
                          {relativeTime(event.at)}
                        </time>
                        {trail.secondary ? (
                          <p className="min-w-0 truncate text-[12.5px] text-muted-foreground">
                            {trail.secondary}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
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

function nextUpTarget(kind: VisibleAttentionKind, oldest?: IdentityIssue) {
  const target =
    kind === "no-subsidiary" ? "/subsidiaries" : "/identity-access/people";
  const search = oldest ? { q: oldest.email } : {};
  return { search, target } as const;
}

function NextUpCalloutBody({
  issues,
  kind,
}: {
  issues: IdentityIssue[];
  kind: VisibleAttentionKind;
}) {
  const oldest = [...issues].sort((a, b) => b.ageDays - a.ageDays)[0];
  const copy = attentionCopy[kind];
  const { search, target } = nextUpTarget(kind, oldest);

  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[13px]">{copy.title}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {copy.consequence}
        </p>
        {oldest ? (
          <p className={`${FIGURE} mt-1 truncate text-muted-foreground`}>
            Oldest: {oldest.ageDays}d · {oldest.name || oldest.email}
          </p>
        ) : null}
      </div>
      <Button
        className="sm:shrink-0"
        nativeButton={false}
        render={<Link search={search} to={target} />}
        size="sm"
      >
        {copy.action}
      </Button>
    </>
  );
}

function IssueRow({
  issues,
  kind,
}: {
  issues: IdentityIssue[];
  kind: VisibleAttentionKind;
}) {
  const oldest = [...issues].sort((a, b) => b.ageDays - a.ageDays)[0];
  const copy = attentionCopy[kind];
  const target =
    kind === "no-subsidiary" ? "/subsidiaries" : "/identity-access/people";
  const search = oldest ? { q: oldest.email } : {};

  return (
    <li className="row-hover gap-3 sm:grid-cols-[minmax(11rem,0.8fr)_minmax(14rem,1fr)_auto] sm:items-center grid">
      <div className="min-w-0">
        <p className="font-medium text-[13px]">{copy.title}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground tabular-nums">
          {issues.length} {issues.length === 1 ? "person" : "people"}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-muted-foreground">{copy.consequence}</p>
        {oldest ? (
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            Oldest: {oldest.ageDays}d · {oldest.name || oldest.email}
          </p>
        ) : null}
      </div>
      <Button
        nativeButton={false}
        render={<Link search={search} to={target} />}
        size="sm"
        variant="outline"
      >
        {copy.action}
      </Button>
    </li>
  );
}
