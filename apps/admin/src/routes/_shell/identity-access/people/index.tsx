import {
  type AttentionKind,
  IDENTITY_ROLES,
  primaryRoleLabel,
  roleCan,
} from "@repo/contracts/identity";
import { AppTrail, Page } from "@repo/shell/app-shell";
import {
  DataTableColumnVisibility,
  DataTableFacet,
  DataTablePagination,
  DataTableSortHeader,
  DataTableToolbar,
  DataTableView,
  createDataTableColumnHelper,
  useDataTable,
} from "@repo/ui/blocks/data-table";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { relativeTime } from "@repo/ui/lib/relative-time";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { EllipsisIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import {
  COLLECTION,
  Failed,
  FIGURE,
  Mark,
  Nothing,
  PANEL,
} from "../../../../components/admin-surface";
import { IssueAccount } from "../../../../components/issue-account";
import {
  PersonActionItems,
  usePersonAdmin,
} from "../../../../components/person-admin";
import { useCollectionSearch } from "../../../../lib/collection-search";
import {
  dashboardQueryOptions,
  directoryQueryOptions,
  teamNamesByUser,
} from "../../../../lib/directory";
import {
  attentionCopy,
  isVisibleAttention,
  type VisibleAttentionKind,
} from "../../../../lib/identity-operations";
import {
  type PeopleQuery,
  type PeopleSearch,
  type PeopleSlice,
  type PeopleSortField,
  type Person,
  PEOPLE_SORT_FIELDS,
  peopleQueryOptions,
  standingOf,
} from "../../../../lib/people";

type PersonTableRow = {
  account: string;
  access: string;
  attention: VisibleAttentionKind[];
  lastActiveAt: string | Date | null;
  person: Person;
  role: string;
  standing: ReturnType<typeof standingOf>;
  teams: string[];
};

const visibleAttention = (attention: AttentionKind[]) =>
  attention.filter(isVisibleAttention);

const columnHelper = createDataTableColumnHelper<PersonTableRow>();

const columns = columnHelper.columns([
  columnHelper.accessor("account", {
    header: ({ column }) => (
      <DataTableSortHeader column={column}>Account</DataTableSortHeader>
    ),
    cell: ({ row }) => {
      const { person, role, standing, teams } = row.original;
      const named = person.name && person.name !== person.email;
      const initial = (person.name || person.email)
        .trim()
        .charAt(0)
        .toUpperCase();

      return (
        <PersonDetailsButton person={person}>
          <Avatar size="sm">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 text-left">
            <span className="font-medium block truncate text-[0.8125rem] text-foreground">
              {named ? person.name : person.email}
            </span>
            {named ? (
              <span className="font-mono block truncate text-[0.6875rem] text-muted-foreground">
                {person.email}
              </span>
            ) : null}
          </span>
          <span className="sm:hidden sr-only">
            {[role, standing, ...teams].join(", ")}
          </span>
        </PersonDetailsButton>
      );
    },
  }),
  columnHelper.accessor("access", {
    header: ({ column }) => (
      <DataTableSortHeader column={column}>Access</DataTableSortHeader>
    ),
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="text-[13px] text-[var(--sea)]">
          {primaryRoleLabel(row.original.role)}
        </p>
        <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
          {row.original.teams.length > 0
            ? row.original.teams.join(", ")
            : "No team"}
        </p>
      </div>
    ),
  }),
  columnHelper.accessor("lastActiveAt", {
    header: () => <span>Last active</span>,
    cell: ({ getValue }) => (
      <span className={`${FIGURE} text-muted-foreground`}>
        {getValue() ? relativeTime(getValue() as string | Date) : "Never"}
      </span>
    ),
  }),
  columnHelper.accessor("attention", {
    header: () => <span>Attention</span>,
    cell: ({ row }) => <AttentionState row={row.original} />,
  }),
  columnHelper.display({
    id: "actions",
    cell: ({ row }) => <PersonActions person={row.original.person} />,
  }),
]);

function AttentionState({ row }: { row: PersonTableRow }) {
  if (row.standing === "suspended") {
    return <Mark label="Suspended" tone="bad" />;
  }
  if (row.attention.length === 0) {
    return <span className="text-[12.5px] text-muted-foreground">None</span>;
  }

  const visible = row.attention.slice(0, 2);
  const overflow = row.attention.length - visible.length;

  return (
    <div className="gap-x-3 gap-y-1 flex flex-wrap">
      {visible.map((kind) => (
        <Mark key={kind} label={attentionCopy[kind].label} tone="warn" />
      ))}
      {overflow > 0 ? (
        <span className={`${FIGURE} text-muted-foreground`}>+{overflow}</span>
      ) : null}
    </div>
  );
}

/**
 * Standing is chosen here rather than in a facet beside Role because
 * `listUsers` accepts exactly one filter per request. Making it navigation is
 * honest about that: you are looking at one slice of the group at a time.
 */
const peopleSlices = [
  { value: "all", label: "All accounts" },
  { value: "admins", label: "Admins" },
  { value: "suspended", label: "Suspended" },
] as const satisfies ReadonlyArray<{ label: string; value: PeopleSlice }>;

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

function PeopleDataTable({
  collection,
  data,
  groupSize,
  matched,
  narrowed,
  role,
  slice,
}: {
  collection: ReturnType<typeof useCollectionSearch<PeopleSearch>>;
  data: PersonTableRow[];
  groupSize: number;
  matched: number;
  narrowed: boolean;
  role: string | null;
  slice: PeopleSlice;
}) {
  // A slice already holds the one filter slot, so it and Role cannot both be
  // set. Whichever was just chosen wins.
  const narrow = (change: Partial<PeopleSearch>) =>
    collection.update({
      ...change,
      ...(change.slice !== undefined ? { role: undefined } : {}),
      ...(change.role !== undefined ? { slice: undefined } : {}),
    });

  const table = useDataTable({
    columns,
    data,
    // Rows keyed by index remount when the debounced search reorders them,
    // closing an open row menu or leaving it on someone else's account.
    getRowId: (row) => row.person.id,
    // `listUsers` orders by one field.
    enableMultiSort: false,
    manualFiltering: true,
    rowCount: matched,
    ...collection.table,
  });

  return (
    <div className={`min-w-0 flex flex-col ${PANEL}`}>
      <DataTableToolbar
        onSearchChange={collection.setSearchText}
        search={collection.searchText}
        searchLabel="Filter accounts"
        searchPlaceholder="Find a name, or an address with @"
      >
        <div
          aria-label="Slice"
          className="gap-1 flex items-center"
          role="group"
        >
          {peopleSlices.map((option) => (
            <Button
              aria-pressed={slice === option.value}
              key={option.value}
              onClick={() =>
                narrow({
                  slice: option.value === "all" ? undefined : option.value,
                })
              }
              size="sm"
              variant={slice === option.value ? "secondary" : "ghost"}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <DataTableFacet
          label="Role"
          onChange={(values) => narrow({ role: values.at(-1) })}
          options={IDENTITY_ROLES.map(({ id: value, label }) => ({
            label,
            value,
          }))}
          selected={role ? [role] : []}
        />
        {narrowed ? (
          <Button
            onClick={() =>
              narrow({ q: undefined, role: undefined, slice: undefined })
            }
            size="sm"
            variant="ghost"
          >
            Clear
          </Button>
        ) : null}
        <DataTableColumnVisibility
          labels={{
            access: "Access",
            attention: "Attention",
            lastActiveAt: "Last active",
          }}
          table={table}
        />
      </DataTableToolbar>
      <DataTableView
        caption="People and account access"
        columnClassName={(id, kind) =>
          id === "actions"
            ? "w-10 text-right"
            : kind === "cell" && id !== "account"
              ? "text-muted-foreground"
              : ""
        }
        empty="No accounts match that filter."
        mobileRow={(row) => (
          <div className="gap-3 p-4 flex items-start justify-between">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {row.person.name || row.person.email}
              </p>
              <p className="font-mono text-xs truncate text-muted-foreground">
                {row.person.email}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {primaryRoleLabel(row.role)} ·{" "}
                {row.teams.length ? row.teams.join(", ") : "No team"}
              </p>
            </div>
            <PersonActions person={row.person} />
          </div>
        )}
        table={table}
      />
      <DataTablePagination
        countLabel={
          narrowed
            ? `${matched} of ${groupSize} accounts`
            : `${matched} accounts`
        }
        table={table}
      />
    </div>
  );
}

function PersonDetailsButton({
  children,
  person,
}: {
  children: ReactNode;
  person: Person;
}) {
  const search = Route.useSearch();

  return (
    <Link
      className="min-w-0 gap-2.5 py-1 flex w-full items-center rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      params={{ personId: person.id }}
      search={search}
      to="/identity-access/people/$personId"
    >
      {children}
    </Link>
  );
}

function PersonActions({ person }: { person: Person }) {
  const admin = usePersonAdmin(person);
  const search = Route.useSearch();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for ${person.email}`}
              data-tone="muted"
              size="icon-sm"
              variant="ghost"
            >
              <EllipsisIcon aria-hidden="true" strokeWidth={1.5} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-44">
          <PersonActionItems actions={admin.offered} admin={admin}>
            <DropdownMenuItem
              render={
                <Link
                  params={{ personId: person.id }}
                  search={search}
                  to="/identity-access/people/$personId"
                />
              }
            >
              View details
            </DropdownMenuItem>
          </PersonActionItems>
        </DropdownMenuContent>
      </DropdownMenu>

      {admin.dialogs}
    </>
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
