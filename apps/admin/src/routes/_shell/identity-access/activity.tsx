import { AppTrail, Page } from "@repo/shell/app-shell";
import { Input } from "@repo/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@repo/ui/components/native-select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { relativeTime } from "@repo/ui/lib/relative-time";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Failed,
  Mark,
  FIGURE,
  PANEL,
  TOOLBAR,
  COLLECTION,
} from "../../../components/admin-surface";
import { dashboardQueryOptions } from "../../../lib/directory";
import { eventAction } from "../../../lib/identity-operations";

export const Route = createFileRoute("/_shell/identity-access/activity")({
  component: RecentActivity,
});

/** Password and passkey sign-ins both open a session. */
const isSignIn = (type: string) => type.startsWith("user.signed-in");

function RecentActivity() {
  const dashboard = useQuery(dashboardQueryOptions);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "change" | "sign-in">("all");
  const events = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (dashboard.data?.events ?? []).filter((event) => {
      const matchesKind =
        kind === "all" ||
        (kind === "sign-in" ? isSignIn(event.type) : !isSignIn(event.type));
      const matchesQuery =
        !needle ||
        `${event.type} ${event.actor} ${event.target ?? ""} ${event.detail ?? ""}`
          .toLowerCase()
          .includes(needle);
      return matchesKind && matchesQuery;
    });
  }, [dashboard.data, kind, query]);

  return (
    <Page
      breadcrumb={
        <AppTrail
          items={[
            { label: "Identity & access", to: "/identity-access" },
            { label: "Activity" },
          ]}
        />
      }
      title="Recent activity"
    >
      <div className={COLLECTION}>
        {dashboard.isPending ? (
          <div className={cn(PANEL, "gap-2 px-3 py-4 flex flex-col")}>
            <Skeleton className="h-8" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : dashboard.isError ? (
          <Failed
            error={dashboard.error}
            onRetry={() => void dashboard.refetch()}
            what="activity log"
          />
        ) : (
          <div className={PANEL}>
            <div className={`${TOOLBAR} px-3 py-2 border-b border-border`}>
              <div className="min-w-0 gap-2 flex flex-1 items-center">
                <SearchIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <Input
                  aria-label="Filter recent activity"
                  className="h-8"
                  data-bare
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find an actor, action, or target"
                  value={query}
                />
              </div>
              <label className="gap-2 flex items-center text-[12.5px] text-muted-foreground">
                Event type
                <NativeSelect
                  className="w-36"
                  onChange={(event) =>
                    setKind(event.target.value as typeof kind)
                  }
                  value={kind}
                >
                  <NativeSelectOption value="all">
                    All activity
                  </NativeSelectOption>
                  <NativeSelectOption value="change">
                    Changes
                  </NativeSelectOption>
                  <NativeSelectOption value="sign-in">
                    Sign-ins
                  </NativeSelectOption>
                </NativeSelect>
              </label>
            </div>
            {events.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                No recent activity matches these filters.
              </p>
            ) : (
              <ul className="px-3 py-1">
                {events.map((event) => (
                  <li
                    className="row-hover gap-2 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(12rem,1fr)_minmax(10rem,0.8fr)_auto] sm:items-center grid"
                    key={event.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-foreground">
                        {event.actor}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] text-foreground">
                        {eventAction(event)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-muted-foreground">
                        {event.target || "Not retained"}
                      </p>
                    </div>
                    <div className="sm:items-end gap-1 flex flex-col">
                      <Mark
                        label={isSignIn(event.type) ? "Sign-in" : "Change"}
                        tone={isSignIn(event.type) ? "away" : "waiting"}
                      />
                      <time
                        className={`${FIGURE} text-muted-foreground`}
                        dateTime={new Date(event.at).toISOString()}
                        title={new Date(event.at).toLocaleString()}
                      >
                        {relativeTime(event.at)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
