import { AppTrail, Page } from "@repo/shell/app-shell";
import { authClient } from "@repo/shell/auth-client";
import { WORKSPACE_URL } from "@repo/shell/session";
import {
  DataTableColumnVisibility,
  DataTableFacet,
  DataTablePagination,
  DataTableSortHeader,
  DataTableToolbar,
  DataTableView,
  createDataTableColumnHelper,
  useDataTable,
  useDebouncedValue,
} from "@repo/ui/blocks/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@repo/ui/components/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  getRouteApi,
  Link,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { functionalUpdate, type SortingState } from "@tanstack/react-table";
import { EllipsisIcon, MonitorIcon } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  COLUMN,
  COLLECTION,
  Failed,
  FIGURE,
  Mark,
  MONO,
  Nothing,
  PANEL,
} from "../../components/admin-surface";
import { IssueAccount } from "../../components/issue-account";
import {
  EditPersonDialog,
  ResetPasswordDialog,
  SuspendPersonDialog,
} from "../../components/person-admin-dialogs";
import type {
  AttentionKind,
  PeopleQuery,
  PeopleSearch,
  PeopleSlice,
  Person,
  VisibleAttentionKind,
} from "../../lib/admin";
import {
  announce,
  dashboardQueryOptions,
  directoryQueryOptions,
  everyPersonQueryOptions,
  linkedAccountsQueryOptions,
  personSessionsQueryOptions,
  peopleQueryOptions,
  removePosition,
  savePosition,
  standingOf,
  teamNamesByUser,
  write,
} from "../../lib/admin";
import { relativeTime } from "../../lib/identity-operations";

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

const visibleAttention = (attention: AttentionKind[]): VisibleAttentionKind[] =>
  attention.filter(
    (kind): kind is VisibleAttentionKind => kind !== "temporary-password",
  );

const columnHelper = createDataTableColumnHelper<PersonTableRow>();

/**
 * Sorting is the database's now, so only the columns `auth.user` actually holds
 * can carry a sort header. Access sorts by role and nothing else — the team
 * names beside it are merged in here, and the database cannot order by them.
 */
const SORT_FIELDS: Record<string, string> = {
  access: "role",
  account: "name",
};

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
        <p className="text-[13px] text-[var(--sea)] capitalize">
          {row.original.role}
        </p>
        <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
          {row.original.teams.length > 0
            ? row.original.teams.join(", ")
            : "No domain access"}
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

const attentionLabels: Record<VisibleAttentionKind, string> = {
  "no-subsidiary": "No subsidiary",
  "unverified-email": "Unverified email",
};

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
        <Mark key={kind} label={attentionLabels[kind]} tone="warn" />
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

const ROLE_VALUES = [
  "user",
  "access-reviewer",
  "helpdesk",
  "admin",
  "super-admin",
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Identity administrator",
  "access-reviewer": "Access reviewer",
  helpdesk: "Helpdesk",
  "super-admin": "Super administrator",
  user: "Employee",
};

const roleLabel = (value: string) =>
  ROLE_LABELS[value] ?? value[0]!.toUpperCase() + value.slice(1);

const PAGE_SIZES = [10, 25, 50, 100];

export const Route = createFileRoute("/_shell/")({
  beforeLoad: () => {
    throw redirect({ to: "/identity-access/work-queue" });
  },
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
export function People() {
  const { session } = shellRoute.useRouteContext();
  const operatorRoles = (session?.user?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const canIssueAccount = operatorRoles.some((role) =>
    ["admin", "super-admin"].includes(role),
  );
  const canAssignPrivileged = operatorRoles.includes("super-admin");
  const search = useRouterState({
    select: (state) => state.location.search as PeopleSearch,
  });
  const slice = search.slice ?? "all";
  const sort = search.sort ?? "account";
  const sortField = sort.replace(/^-/, "");

  const query: PeopleQuery = {
    page: search.page ?? 1,
    pageSize: search.size ?? 25,
    role: slice === "all" ? (search.role ?? null) : null,
    search: search.q ?? "",
    slice,
    sort: {
      direction: sort.startsWith("-") ? "desc" : "asc",
      field: SORT_FIELDS[sortField] ?? "name",
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
            data={rows}
            groupSize={groupSize}
            matched={matched}
            narrowed={narrowed}
            page={query.page}
            pageSize={query.pageSize}
            query={search.q ?? ""}
            role={query.role}
            slice={slice}
            sort={sort}
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
  data,
  groupSize,
  matched,
  narrowed,
  page,
  pageSize,
  query: initialQuery,
  role,
  slice,
  sort,
}: {
  data: PersonTableRow[];
  groupSize: number;
  matched: number;
  narrowed: boolean;
  page: number;
  pageSize: number;
  query: string;
  role: string | null;
  slice: PeopleSlice;
  sort: string;
}) {
  const navigate = useNavigate();
  const onPeople = useRouterState({
    select: (state) => state.location.pathname === "/identity-access/people",
  });
  const [text, setText] = useState(initialQuery);
  const debouncedText = useDebouncedValue(text);

  /**
   * Every control writes to the URL and the URL is the only state, so a filtered
   * page is a link someone can send. Anything that changes what matches returns
   * to page one — staying on page 7 of a result set that now has two pages shows
   * an empty table and no reason for it.
   */
  const go = useCallback(
    (change: Partial<PeopleSearch>) => {
      const next: PeopleSearch = {
        ...(initialQuery ? { q: initialQuery } : {}),
        ...(slice === "all" ? {} : { slice }),
        ...(role ? { role } : {}),
        ...(sort === "account" ? {} : { sort }),
        ...(page > 1 ? { page } : {}),
        ...(pageSize === 25 ? {} : { size: pageSize }),
        ...change,
      };
      if (!("page" in change)) delete next.page;
      // A slice already holds the one filter slot, so it and Role cannot both
      // be set. Whichever was just chosen wins.
      if (change.slice !== undefined) delete next.role;
      if (change.role !== undefined) delete next.slice;
      void navigate({
        replace: true,
        search: next,
        to: "/identity-access/people",
      });
    },
    [initialQuery, navigate, page, pageSize, role, slice, sort],
  );

  /**
   * The search box is the one control whose value does not live in the URL, so
   * a debounce carries it there. It must stop at the page boundary: while a
   * navigation away is settling this component is still mounted, but the search
   * it reads is already the new route's — empty. Without the guard the box and
   * the URL disagree, the debounce "corrects" the URL, and `go` sends everyone
   * back to the People route. Leaving the page becomes impossible with a
   * search active.
   */
  useEffect(() => {
    if (!onPeople) return;
    if (debouncedText.trim() === initialQuery) return;
    go({ q: debouncedText.trim() || undefined });
  }, [debouncedText, go, initialQuery, onPeople]);

  const sorting = useMemo<SortingState>(
    () => [{ desc: sort.startsWith("-"), id: sort.replace(/^-/, "") }],
    [sort],
  );

  const table = useDataTable({
    columns,
    data,
    // Rows keyed by index remount when the debounced search reorders them,
    // closing an open row menu or leaving it on someone else's account.
    getRowId: (row) => row.person.id,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    onPaginationChange: (updater) => {
      const next = functionalUpdate(updater, {
        pageIndex: page - 1,
        pageSize,
      });
      go({
        page: next.pageIndex + 1,
        size: next.pageSize === 25 ? undefined : next.pageSize,
        // A larger page cannot keep the offset a smaller one was on.
        ...(next.pageSize === pageSize ? {} : { page: 1 }),
      });
    },
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting)[0];
      go({
        sort: next
          ? `${next.desc ? "-" : ""}${next.id}` === "account"
            ? undefined
            : `${next.desc ? "-" : ""}${next.id}`
          : undefined,
      });
    },
    rowCount: matched,
    state: {
      pagination: { pageIndex: page - 1, pageSize },
      sorting,
    },
  });

  return (
    <div className={`min-w-0 flex flex-col ${PANEL}`}>
      <DataTableToolbar
        onSearchChange={setText}
        search={text}
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
                go({
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
          onChange={(values) => go({ role: values.at(-1) })}
          options={ROLE_VALUES.map((value) => ({
            label: roleLabel(value),
            value,
          }))}
          selected={role ? [role] : []}
        />
        {narrowed ? (
          <Button
            onClick={() => {
              // The box as well as the URL. The debounce watches this state and
              // would put the query straight back otherwise, so clearing one
              // without the other reads as a button that does nothing.
              setText("");
              go({ q: undefined, role: undefined, slice: undefined });
            }}
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
                {row.role} ·{" "}
                {row.teams.length ? row.teams.join(", ") : "No domain access"}
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
        pageSizes={PAGE_SIZES}
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
  const search = useRouterState({
    select: (state) => state.location.search as PeopleSearch,
  });

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

type PersonAction =
  | "delete"
  | "edit"
  | "impersonate"
  | "password"
  | "restore"
  | "sessions"
  | "suspend";

/**
 * What the operator in front of us may do to this person, and the machinery to
 * do it.
 *
 * One hook rather than one component because two surfaces offer the same acts:
 * the row's ⋯ menu, and the header of the detail sheet. A sheet you can read but
 * not act from sends you back to the menu you just left.
 */
export function usePersonAdmin(person: Person) {
  const { session } = shellRoute.useRouteContext();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PersonAction | null>(null);

  const operatorRoles = (session?.user?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const personRoles = (person.role ?? "").split(",").map((role) => role.trim());
  const operatorIsSuperAdmin = operatorRoles.includes("super-admin");
  const operatorIsAdmin = operatorRoles.includes("admin");
  const operatorIsHelpdesk = operatorRoles.includes("helpdesk");
  const personIsPrivileged = personRoles.some((role) =>
    ["access-reviewer", "helpdesk", "admin", "super-admin"].includes(role),
  );
  const isSelf = session?.user?.id === person.id;

  // The UI mirrors the server's target hierarchy: only break-glass may act on
  // another privileged account. Reviewers are read-only; helpdesk can reset a
  // standard account and revoke its sessions, but cannot edit or suspend it.
  const targetIsManageable = operatorIsSuperAdmin || !personIsPrivileged;
  const canAdminister =
    (operatorIsAdmin || operatorIsSuperAdmin) && targetIsManageable;
  const canResetPassword =
    (operatorIsHelpdesk || operatorIsAdmin || operatorIsSuperAdmin) &&
    targetIsManageable &&
    !isSelf;
  const canRevokeSessions = canResetPassword;
  const canSuspend = canAdminister && !isSelf;
  const canDelete = operatorIsSuperAdmin && !isSelf;
  const canImpersonate = operatorIsSuperAdmin && !isSelf;

  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "people"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
      ]),
    [queryClient],
  );

  // Through write(), because better-auth resolves with { error } rather than
  // rejecting. Without it every one of these reports a success it did not have.
  const restore = useMutation({
    mutationFn: () =>
      write(
        () => authClient.admin.unbanUser({ userId: person.id }),
        "Access was not restored.",
      ),
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`${person.email} can sign in again`);
      void refresh();
    },
  });

  // The only action here that leaves no trace in the table, so the toast is the
  // whole of its feedback.
  const revoke = useMutation({
    mutationFn: () =>
      write(
        () => authClient.admin.revokeUserSessions({ userId: person.id }),
        "The sessions were not revoked.",
      ),
    onError: announce.failed,
    onSuccess: () => announce.done(`Signed ${person.email} out everywhere`),
  });

  const impersonate = useMutation({
    mutationFn: () =>
      write(
        () => authClient.admin.impersonateUser({ userId: person.id }),
        "Impersonation did not start.",
      ),
    onError: announce.failed,
    onSuccess: () => window.location.assign(WORKSPACE_URL),
  });

  const remove = useMutation({
    mutationFn: () =>
      write(
        () => authClient.admin.removeUser({ userId: person.id }),
        "The account was not deleted.",
      ),
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`${person.email} was deleted`);
      void refresh();
    },
  });

  const confirmation =
    pending === "sessions"
      ? {
          title: "Revoke all sessions?",
          description: `${person.email} will be signed out on every device.`,
          label: "Revoke sessions",
          run: () => revoke.mutate(),
          destructive: true,
        }
      : pending === "restore"
        ? {
            title: "Restore access?",
            description: `${person.email} will be able to sign in again.`,
            label: "Restore access",
            run: () => restore.mutate(),
            destructive: false,
          }
        : pending === "impersonate"
          ? {
              title: "Impersonate this person?",
              description: `You will enter the workspace as ${person.email}. A persistent notice will let you return to your own session.`,
              label: "Start impersonating",
              run: () => impersonate.mutate(),
              destructive: false,
            }
          : pending === "delete"
            ? {
                title: "Delete this account?",
                description: `${person.email}, their sessions, linked accounts, and memberships will be permanently deleted.`,
                label: "Delete account",
                run: () => remove.mutate(),
                destructive: true,
              }
            : null;

  const close = useCallback(
    (open: boolean) => !open && setPending(null),
    [setPending],
  );

  const dialogs = (
    <>
      <AlertDialog onOpenChange={close} open={confirmation !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmation?.run();
                setPending(null);
              }}
              size="sm"
              variant={confirmation?.destructive ? "destructive" : "default"}
            >
              {confirmation?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <EditPersonDialog
        canAssignSuperAdmin={operatorIsSuperAdmin}
        canChangeRole={operatorIsSuperAdmin && !isSelf}
        onOpenChange={close}
        open={pending === "edit"}
        person={person}
      />
      <ResetPasswordDialog
        onOpenChange={close}
        open={pending === "password"}
        person={person}
      />
      <SuspendPersonDialog
        onOpenChange={close}
        open={pending === "suspend"}
        person={person}
      />
    </>
  );

  return {
    canAdminister,
    canDelete,
    canImpersonate,
    canResetPassword,
    canRevokeSessions,
    canSuspend,
    dialogs,
    request: setPending,
    suspended: Boolean(person.banned),
  };
}

/**
 * Every action here changes what another person can do, so each one is a verb
 * naming its effect on them, not on the record ("Revoke sessions", not "Clear").
 */
function PersonActions({ person }: { person: Person }) {
  const admin = usePersonAdmin(person);
  const search = useRouterState({
    select: (state) => state.location.search as PeopleSearch,
  });

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
          <DropdownMenuGroup>
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
            {admin.canAdminister ? (
              <DropdownMenuItem onClick={() => admin.request("edit")}>
                Edit account
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          {admin.canResetPassword ||
          admin.canRevokeSessions ||
          admin.canImpersonate ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {admin.canResetPassword ? (
                  <DropdownMenuItem onClick={() => admin.request("password")}>
                    Issue new password
                  </DropdownMenuItem>
                ) : null}
                {admin.canRevokeSessions ? (
                  <DropdownMenuItem onClick={() => admin.request("sessions")}>
                    Revoke sessions
                  </DropdownMenuItem>
                ) : null}
                {admin.canImpersonate ? (
                  <DropdownMenuItem
                    onClick={() => admin.request("impersonate")}
                  >
                    Impersonate
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </>
          ) : null}
          {admin.canSuspend || admin.canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {admin.canSuspend ? (
                  <DropdownMenuItem
                    onClick={() =>
                      admin.request(admin.suspended ? "restore" : "suspend")
                    }
                    variant={admin.suspended ? undefined : "destructive"}
                  >
                    {admin.suspended ? "Restore access" : "Suspend access"}
                  </DropdownMenuItem>
                ) : null}
                {admin.canDelete ? (
                  <DropdownMenuItem
                    onClick={() => admin.request("delete")}
                    variant="destructive"
                  >
                    Delete account
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {admin.dialogs}
    </>
  );
}

export function PersonDetails({
  onOpenChange,
  open,
  person,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  person: Person;
}) {
  const queryClient = useQueryClient();
  const admin = usePersonAdmin(person);
  const sessions = useQuery({
    ...personSessionsQueryOptions(person.id),
    enabled: open,
  });
  const accounts = useQuery({
    ...linkedAccountsQueryOptions(person.id),
    enabled: open,
  });
  const directory = useQuery({ ...directoryQueryOptions, enabled: open });
  const people = useQuery({ ...everyPersonQueryOptions, enabled: open });
  const [editingPosition, setEditingPosition] = useState<
    false | "group" | string
  >(false);
  const revoke = useMutation({
    mutationFn: (sessionToken: string) =>
      write(
        () => authClient.admin.revokeUserSession({ sessionToken }),
        "The session was not revoked.",
      ),
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`Session revoked for ${person.email}`);
      void queryClient.invalidateQueries({
        queryKey: ["admin", "people", person.id, "sessions"],
      });
    },
  });

  return (
    <>
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle>{person.name || person.email}</SheetTitle>
            <SheetDescription>{person.email}</SheetDescription>
            {/* The acts belong beside what prompted them. Each still opens its
                own dialog, so nothing here is one mis-click from happening. */}
            <div className="gap-1.5 pt-2 flex flex-wrap">
              {admin.canAdminister ? (
                <Button
                  onClick={() => admin.request("edit")}
                  size="xs"
                  variant="outline"
                >
                  Edit account
                </Button>
              ) : null}
              {admin.canResetPassword || admin.canSuspend ? (
                <>
                  {admin.canResetPassword ? (
                    <Button
                      onClick={() => admin.request("password")}
                      size="xs"
                      variant="outline"
                    >
                      Issue new password
                    </Button>
                  ) : null}
                  {admin.canSuspend ? (
                    <Button
                      onClick={() =>
                        admin.request(admin.suspended ? "restore" : "suspend")
                      }
                      size="xs"
                      variant={admin.suspended ? "outline" : "destructive"}
                    >
                      {admin.suspended ? "Restore access" : "Suspend access"}
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </SheetHeader>
          <dl className="gap-x-4 gap-y-3 px-4 text-xs grid grid-cols-2">
            <Detail label="Role" value={person.role || "user"} />
            <Detail label="Standing" value={standingOf(person)} />
            <Detail
              label="Email"
              value={person.emailVerified ? "Verified" : "Unverified"}
            />
            <Detail
              label="Two-factor"
              value={person.twoFactorEnabled ? "Enabled" : "Not set up"}
            />
            {person.mustChangePassword ? (
              <Detail
                label="Temporary password"
                value={
                  person.temporaryPasswordExpiresAt
                    ? `Expires ${new Date(person.temporaryPasswordExpiresAt).toLocaleString()}`
                    : "Replacement required"
                }
              />
            ) : null}
            <Detail
              label="Created"
              value={new Date(person.createdAt).toLocaleDateString()}
            />
            <Detail label="User ID" mono value={person.id} />
            {person.banned ? (
              <Detail
                label="Suspended because"
                value={person.banReason || "No reason recorded"}
              />
            ) : null}
          </dl>
          <section className="gap-3 px-4 pt-6 flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h2 className={COLUMN}>Position & reporting</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  Directory information only. It does not grant access.
                </p>
              </div>
              {admin.canAdminister ? (
                <Button
                  onClick={() => setEditingPosition("group")}
                  size="xs"
                  variant="outline"
                >
                  Add or edit
                </Button>
              ) : null}
            </div>
            <PositionSummary
              onEdit={setEditingPosition}
              personId={person.id}
              positions={directory.data?.positions ?? []}
              subsidiaries={directory.data?.subsidiaries ?? []}
            />
          </section>
          <section className="gap-3 px-4 pt-6 flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className={COLUMN}>Linked accounts</h2>
              {accounts.data ? (
                <span className={`${FIGURE} text-muted-foreground`}>
                  {accounts.data.length}
                </span>
              ) : null}
            </div>
            {accounts.isPending ? (
              <Skeleton className="h-12 w-full" />
            ) : accounts.isError ? (
              <p className="text-[12.5px] text-destructive">
                {accounts.error.message}
              </p>
            ) : accounts.data.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                No linked accounts.
              </p>
            ) : (
              <ul className="flex flex-col">
                {accounts.data.map((account) => (
                  <li
                    className="row-hover gap-3 flex items-center justify-between"
                    key={account.id}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[13px] text-foreground capitalize">
                        {account.providerId}
                      </p>
                      <p
                        className={`${MONO} mt-0.5 truncate text-muted-foreground`}
                      >
                        {account.accountId}
                      </p>
                    </div>
                    <time
                      className={`${FIGURE} shrink-0 text-muted-foreground`}
                    >
                      {new Date(account.createdAt).toLocaleDateString()}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="gap-3 px-4 pt-6 pb-4 flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className={COLUMN}>Active sessions</h2>
              {sessions.data ? (
                <span className={`${FIGURE} text-muted-foreground`}>
                  {sessions.data.length}
                </span>
              ) : null}
            </div>
            {sessions.isPending ? (
              <div className="gap-2 flex flex-col">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : sessions.isError ? (
              <p className="text-[12.5px] text-destructive">
                {sessions.error.message}
              </p>
            ) : sessions.data.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                No active sessions.
              </p>
            ) : (
              <ul className="flex flex-col">
                {sessions.data.map((session) => (
                  <li
                    className="row-hover gap-2 flex items-start"
                    key={session.id}
                  >
                    <MonitorIcon
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                      strokeWidth={1.5}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs truncate text-foreground">
                        {session.userAgent || "Unknown device"}
                      </p>
                      <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                        {session.ipAddress || "Unknown IP"} · Last used{" "}
                        {new Date(session.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    {admin.canRevokeSessions ? (
                      <Button
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(session.token)}
                        size="xs"
                        variant="ghost"
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </SheetContent>
      </Sheet>
      {editingPosition !== false && directory.data && people.data ? (
        <PositionDialog
          key={editingPosition}
          organizationId={editingPosition === "group" ? null : editingPosition}
          people={people.data}
          person={person}
          positions={directory.data.positions}
          subsidiaries={directory.data.subsidiaries}
          onOpenChange={(next) => !next && setEditingPosition(false)}
        />
      ) : null}
      {admin.dialogs}
    </>
  );
}

export function PositionSummary({
  canEdit = true,
  onEdit,
  personId,
  positions,
  subsidiaries,
}: {
  canEdit?: boolean;
  onEdit: (scope: "group" | string) => void;
  personId: string;
  positions: import("../../lib/admin").Position[];
  subsidiaries: { id: string; name: string }[];
}) {
  const rows = positions.filter((position) => position.userId === personId);
  const subsidiaryById = new Map(
    subsidiaries.map((subsidiary) => [subsidiary.id, subsidiary]),
  );
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No position recorded.</p>
    );
  }
  return (
    <ul className="gap-1 grid">
      {rows.map((position) => (
        <li
          className="row-hover-bg gap-3 px-2 py-2 flex items-center justify-between rounded-md"
          key={position.id}
        >
          <div className="min-w-0">
            <p className="text-xs truncate">{position.title}</p>
            <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
              {position.organizationId
                ? (subsidiaryById.get(position.organizationId)?.name ??
                  position.organizationId)
                : "Group"}
            </p>
          </div>
          {canEdit ? (
            <Button
              onClick={() => onEdit(position.organizationId ?? "group")}
              size="xs"
              variant="ghost"
            >
              Edit
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function PositionDialog({
  organizationId: initialOrganizationId,
  people,
  person,
  positions,
  subsidiaries,
  onOpenChange,
}: {
  organizationId: string | null;
  people: Person[];
  person: Person;
  positions: import("../../lib/admin").Position[];
  subsidiaries: { id: string; memberIds: string[]; name: string }[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [organizationId, setOrganizationId] = useState(
    initialOrganizationId ?? "group",
  );
  const resolvedOrganizationId =
    organizationId === "group" ? null : organizationId;
  const existing = positions.find(
    (position) =>
      position.userId === person.id &&
      position.organizationId === resolvedOrganizationId,
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [managerUserId, setManagerUserId] = useState(
    existing?.managerUserId ?? "",
  );
  const availableSubsidiaries = subsidiaries.filter((subsidiary) =>
    subsidiary.memberIds.includes(person.id),
  );
  const availableManagers = people.filter(
    (candidate) =>
      candidate.id !== person.id &&
      (!resolvedOrganizationId ||
        availableSubsidiaries
          .find((subsidiary) => subsidiary.id === resolvedOrganizationId)
          ?.memberIds.includes(candidate.id)),
  );
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: directoryQueryOptions.queryKey });
  const save = useMutation({
    mutationFn: () =>
      savePosition({
        managerUserId: managerUserId || null,
        organizationId: resolvedOrganizationId,
        title,
        userId: person.id,
      }),
    onError: announce.failed,
    onSuccess: () => {
      announce.done("Position saved");
      void refresh();
      onOpenChange(false);
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      removePosition({
        organizationId: resolvedOrganizationId,
        userId: person.id,
      }),
    onError: announce.failed,
    onSuccess: () => {
      announce.done("Position removed");
      void refresh();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Position & reporting</DialogTitle>
          <DialogDescription>
            Record how {person.name || person.email} appears in the directory.
            This never changes their permissions.
          </DialogDescription>
        </DialogHeader>
        <div className="gap-4 grid">
          <label className="gap-2 text-sm font-medium grid">
            Scope
            <NativeSelect
              className="w-full"
              value={organizationId}
              onChange={(event) => {
                const next = event.target.value;
                setOrganizationId(next);
                const row = positions.find(
                  (position) =>
                    position.userId === person.id &&
                    position.organizationId ===
                      (next === "group" ? null : next),
                );
                setTitle(row?.title ?? "");
                setManagerUserId(row?.managerUserId ?? "");
              }}
            >
              <NativeSelectOption value="group">Group</NativeSelectOption>
              {availableSubsidiaries.map((subsidiary) => (
                <NativeSelectOption key={subsidiary.id} value={subsidiary.id}>
                  {subsidiary.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <div className="gap-2 grid">
            <Label htmlFor="position-title">Title</Label>
            <Input
              id="position-title"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </div>
          <label className="gap-1.5 text-sm font-medium grid">
            {/* The hint ends where the control’s text column ends, not at its border. */}
            <span className="gap-2 pr-2.75 flex items-baseline justify-between">
              Reports to
              <span className="font-normal text-muted-foreground">
                optional
              </span>
            </span>
            <NativeSelect
              className="w-full"
              value={managerUserId}
              onChange={(event) => setManagerUserId(event.target.value)}
            >
              <NativeSelectOption value="">
                No manager recorded
              </NativeSelectOption>
              {availableManagers.map((candidate) => (
                <NativeSelectOption key={candidate.id} value={candidate.id}>
                  {candidate.name || candidate.email}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        </div>
        <DialogFooter className="sm:justify-between">
          {existing ? (
            <Button
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
              size="sm"
              variant="ghost"
            >
              Remove
            </Button>
          ) : null}
          <div className="gap-2 sm:flex-row sm:justify-end flex flex-col-reverse">
            <DialogClose render={<Button size="sm" variant="outline" />}>
              Close
            </DialogClose>
            <Button
              disabled={save.isPending || !title.trim()}
              onClick={() => save.mutate()}
              size="sm"
            >
              Save position
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "mt-1 font-mono truncate text-foreground"
            : "mt-1 truncate text-[13px] text-foreground"
        }
        title={value}
      >
        {value}
      </dd>
    </div>
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
