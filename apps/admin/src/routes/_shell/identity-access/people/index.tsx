import { type AttentionKind, roleCan } from "@repo/contracts/identity";
import { AppTrail, Page } from "@repo/shell/app-shell";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  COLLECTION,
  Failed,
  Nothing,
} from "../../../../components/admin-surface";
import { IssueAccount } from "../../../../components/issue-account";
import { PeopleDataTable } from "../../../../components/people-table";
import { useCollectionSearch } from "../../../../lib/collection-search";
import {
  dashboardQueryOptions,
  directoryQueryOptions,
  teamNamesByUser,
} from "../../../../lib/directory";
import { isVisibleAttention } from "../../../../lib/identity-operations";
import {
  type PeopleQuery,
  type PeopleSortField,
  PEOPLE_SORT_FIELDS,
  peopleQueryOptions,
  standingOf,
} from "../../../../lib/people";

const visibleAttention = (attention: AttentionKind[]) =>
  attention.filter(isVisibleAttention);

export const Route = createFileRoute("/_shell/identity-access/people/")({
  component: People,
});

const shellRoute = getRouteApi("/_shell");

/**
 * Everyone with an account, and what each of them can reach.
 *
 * Three reads, one page. `listUsers` returns the accounts — searched, filtered,
 * sorted and paged by the database — and the group-wide directory and dashboard
 * reads supply the two things the `auth` tables do not hold: which teams someone
 * is in, and what about them needs acting on. Those are merged onto whichever
 * accounts came back, which is why Last active and Attention read but do not
 * sort: the database never saw them.
 */
function People() {
  const { session } = shellRoute.useRouteContext();
  const canIssueAccount = roleCan(session?.user?.role, "user", "create");
  const canAssignPrivileged = roleCan(session?.user?.role, "user", "set-role");
  const search = Route.useSearch();
  const collection = useCollectionSearch({
    defaultSort: "account",
    search,
    to: Route.fullPath,
  });
  const slice = search.slice ?? "all";
  const { sort } = collection;

  const query: PeopleQuery = {
    page: collection.page,
    pageSize: collection.size,
    role: slice === "all" ? (search.role ?? null) : null,
    search: collection.q,
    slice,
    sort: {
      direction: sort.startsWith("-") ? "desc" : "asc",
      field:
        PEOPLE_SORT_FIELDS[sort.replace(/^-/, "") as PeopleSortField] ?? "name",
    },
  };

  const people = useQuery(peopleQueryOptions(query));
  const directory = useQuery(directoryQueryOptions);
  const dashboard = useQuery(dashboardQueryOptions);

  const rows = useMemo(() => {
    const domainsByPerson = teamNamesByUser(directory.data);
    const healthByPerson = new Map(
      (dashboard.data?.people ?? []).map((health) => [health.userId, health]),
    );

    return (people.data?.people ?? []).map((person) => {
      const teams = domainsByPerson[person.id] ?? [];
      const health = healthByPerson.get(person.id);

      return {
        account: `${person.email} ${person.name}`,
        access: `${person.role || "user"} ${teams.join(" ")}`,
        attention: visibleAttention(health?.attention ?? []),
        lastActiveAt: health?.lastActiveAt ?? null,
        person,
        role: person.role || "user",
        standing: standingOf(person),
        teams,
      };
    });
  }, [dashboard.data, directory.data, people.data]);

  const matched = people.data?.total ?? 0;
  const groupSize = dashboard.data?.counts.users ?? 0;
  const narrowed = Boolean(search.q || search.role) || slice !== "all";

  return (
    <Page
      actions={
        canIssueAccount ? (
          <IssueAccount canAssignPrivileged={canAssignPrivileged} />
        ) : null
      }
      breadcrumb={
        <AppTrail
          items={[
            { label: "Identity & access", to: "/identity-access" },
            { label: "People" },
          ]}
        />
      }
      title="People"
    >
      {people.isError ? (
        <Failed
          error={{
            message: `${people.error.message} The core service may be down; nothing has been changed.`,
          }}
          onRetry={() => void people.refetch()}
          what="group"
        />
      ) : people.isPending ? (
        <TableSkeleton />
      ) : groupSize === 0 && matched === 0 ? (
        <Nothing title="No accounts yet">
          {canIssueAccount
            ? "Issue the first account to add someone to Tagaroa."
            : "An identity administrator must issue the first account."}
        </Nothing>
      ) : (
        <div className={COLLECTION}>
          <PeopleSummary
            health={dashboard.data?.people ?? []}
            privileged={dashboard.data?.accessReview.total ?? 0}
          />
          <PeopleDataTable
            collection={collection}
            data={rows}
            groupSize={groupSize}
            matched={matched}
            narrowed={narrowed}
            role={query.role}
            slice={slice}
          />
        </div>
      )}
    </Page>
  );
}

/**
 * The group in one line, and deliberately about the whole group rather than the
 * page below it: a count that changed every time you turned a page would be
 * measuring your own navigation.
 */
function PeopleSummary({
  health,
  privileged,
}: {
  health: { attention: AttentionKind[]; lastActiveAt: string | Date | null }[];
  privileged: number;
}) {
  const [now] = useState(Date.now);
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const needsAttention = health.filter(
    (person) => visibleAttention(person.attention).length > 0,
  ).length;
  const active = health.filter(
    (person) =>
      person.lastActiveAt &&
      new Date(person.lastActiveAt).getTime() >= oneWeekAgo,
  ).length;

  return (
    <p className="gap-x-2.5 gap-y-1 flex flex-wrap items-baseline text-[12px] text-muted-foreground">
      <span>
        <span className="font-medium text-foreground tabular-nums">
          {needsAttention}
        </span>{" "}
        need attention
      </span>
      <span aria-hidden="true">·</span>
      <span>
        <span className="text-foreground tabular-nums">{privileged}</span>{" "}
        privileged
      </span>
      <span aria-hidden="true">·</span>
      <span>
        <span className="text-foreground tabular-nums">{active}</span> active
        this week
      </span>
    </p>
  );
}

/** The table's own shape while it loads, so the page does not reflow when the
 * group lands under the pointer. */
function TableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead className="sm:table-cell hidden">Role</TableHead>
          <TableHead className="sm:table-cell hidden">Standing</TableHead>
          <TableHead className="sm:table-cell hidden">Domains</TableHead>
          <TableHead className="w-px" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }, (_, row) => (
          <TableRow key={row}>
            <TableCell colSpan={5}>
              <Skeleton className="my-2 h-4 w-64 max-w-full" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
