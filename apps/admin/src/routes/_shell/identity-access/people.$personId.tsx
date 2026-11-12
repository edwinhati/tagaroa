import { primaryRoleLabel } from "@repo/contracts/identity";
import { AppTrail, Page } from "@repo/shell/app-shell";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EllipsisIcon } from "lucide-react";

import {
  Mark,
  MONO,
  COLLECTION,
  Nothing,
  SurfaceBanner,
} from "../../../components/admin-surface";
import { IdentitySecurityOperations } from "../../../components/identity-security-operations";
import {
  ACTION_LABELS,
  DESTRUCTIVE,
  type PersonAction,
  PersonActionItems,
  type PersonAdmin,
  usePersonAdmin,
} from "../../../components/person-admin";
import { AccessTab } from "../../../components/person-workspace/access-tab";
import { ActivityTab } from "../../../components/person-workspace/activity-tab";
import {
  SignInSummary,
  SignInTab,
} from "../../../components/person-workspace/sign-in-tab";
import { attentionCopy } from "../../../lib/identity-operations";
import {
  type PeopleSearch,
  type Person,
  personQueryOptions,
  standingOf,
} from "../../../lib/people";

export const Route = createFileRoute(
  "/_shell/identity-access/people/$personId",
)({
  component: PersonRoute,
});

function PersonRoute() {
  const { personId } = Route.useParams();
  const search = Route.useSearch();

  return <PersonWorkspace personId={personId} search={search} />;
}

function PersonWorkspace({
  personId,
  search,
}: {
  personId: string;
  search: PeopleSearch;
}) {
  const person = useQuery(personQueryOptions(personId));

  if (person.isPending) return <PersonWorkspaceSkeleton />;
  if (person.isError || !person.data) {
    return (
      <Page
        breadcrumb={
          <AppTrail
            items={[
              {
                label: "People",
                search: search as Record<string, unknown>,
                to: "/identity-access/people",
              },
              { label: "Unavailable" },
            ]}
          />
        }
        title="Account unavailable"
      >
        <Nothing title="Unable to open this account">
          {person.error?.message ?? "The account may no longer exist."}
        </Nothing>
        <div className="mt-4 flex justify-center">
          <Button
            nativeButton={false}
            render={<Link search={search} to="/identity-access/people" />}
            size="sm"
            variant="outline"
          >
            Return to people
          </Button>
        </div>
      </Page>
    );
  }

  return <PersonWorkspaceContent person={person.data} search={search} />;
}

/** The acts kept one step away at the foot of the page. */
const QUICK_ACTIONS: readonly PersonAction[] = [
  "password",
  "sessions",
  "suspend",
  "restore",
];

function PersonWorkspaceContent({
  person,
  search,
}: {
  person: Person;
  search: PeopleSearch;
}) {
  const admin = usePersonAdmin(person);
  const quickActions = QUICK_ACTIONS.filter(admin.offers);

  return (
    <Page
      actions={
        <div className="gap-2 flex items-center">
          {admin.offers("edit") ? (
            <Button onClick={() => admin.request("edit")} size="sm">
              {ACTION_LABELS.edit}
            </Button>
          ) : null}
          <PersonActionMenu admin={admin} person={person} />
        </div>
      }
      breadcrumb={
        <AppTrail
          items={[
            {
              label: "People",
              search: search as Record<string, unknown>,
              to: "/identity-access/people",
            },
            { label: person.name || person.email },
          ]}
        />
      }
      description={
        <span className="gap-x-3 gap-y-1 flex flex-wrap items-center">
          <span className={MONO}>{person.email}</span>
          <Mark
            label={standingOf(person) === "suspended" ? "Suspended" : "Active"}
            tone={standingOf(person) === "suspended" ? "bad" : "done"}
          />
          <span>{primaryRoleLabel(person.role)}</span>
        </span>
      }
      title={person.name || person.email}
    >
      <div className={`${COLLECTION} ${quickActions.length ? "pb-16" : ""}`}>
        {standingOf(person) === "suspended" ||
        !person.emailVerified ||
        person.mustChangePassword ? (
          <SurfaceBanner tone="warn">
            <p>
              <span className="font-medium text-foreground">
                {accountAttentionTitle(person)}
              </span>{" "}
              {accountAttention(person)}
            </p>
          </SurfaceBanner>
        ) : null}

        <IdentitySecurityOperations person={person} />

        <div className="gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] grid items-start">
          <Tabs defaultValue="access">
            <TabsList aria-label="Account sections" variant="line">
              <TabsTrigger value="access">Access</TabsTrigger>
              <TabsTrigger value="sign-in">Sign-in</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="access">
              <AccessTab canEdit={admin.offers("edit")} person={person} />
            </TabsContent>
            <TabsContent value="sign-in">
              <SignInTab canRevoke={admin.offers("sessions")} person={person} />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityTab person={person} />
            </TabsContent>
          </Tabs>
          <SignInSummary person={person} />
        </div>
      </div>

      {quickActions.length ? (
        <div className="bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 py-3 sm:px-6 lg:px-8 sticky z-10 border-t border-border/80 bg-background/95">
          <div className="gap-2 flex flex-wrap items-center justify-between">
            <p className="text-[12px] text-muted-foreground">
              Dangerous actions stay one step away.
            </p>
            <div className="gap-1.5 flex flex-wrap">
              {quickActions.map((action) => (
                <Button
                  key={action}
                  onClick={() => admin.request(action)}
                  size="sm"
                  type="button"
                  variant={DESTRUCTIVE.has(action) ? "destructive" : "outline"}
                >
                  {ACTION_LABELS[action]}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {admin.dialogs}
    </Page>
  );
}

function PersonActionMenu({
  admin,
  person,
}: {
  admin: PersonAdmin;
  person: Person;
}) {
  // Edit has its own button beside this menu.
  const actions = admin.offered.filter((action) => action !== "edit");
  if (actions.length === 0) return <Mark label="Read only" tone="waiting" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`More actions for ${person.email}`}
            size="icon-sm"
            variant="outline"
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-48">
        <PersonActionItems actions={actions} admin={admin} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function accountAttentionTitle(person: Person): string {
  if (standingOf(person) === "suspended") return "Sign-in is suspended.";
  if (person.mustChangePassword) return "Still on a temporary password.";
  return "Work email not verified.";
}

function accountAttention(person: Person): string {
  const issues = [
    standingOf(person) === "suspended"
      ? "They cannot sign in until access is restored."
      : null,
    !person.emailVerified
      ? attentionCopy["unverified-email"].consequence
      : null,
    person.mustChangePassword
      ? "They must replace it before reaching the workspace."
      : null,
  ].filter(Boolean);
  return issues.join(" ");
}

function PersonWorkspaceSkeleton() {
  return (
    <Page
      breadcrumb={
        <AppTrail
          items={[
            { label: "Identity & access", to: "/identity-access" },
            { label: "People" },
          ]}
        />
      }
      description="Reading account details…"
      title="Person"
    >
      <div className={COLLECTION}>
        <Skeleton className="h-20 rounded-[var(--panel-radius)]" />
        <Skeleton className="h-40 rounded-[var(--panel-radius)]" />
        <Skeleton className="h-56 rounded-[var(--panel-radius)]" />
      </div>
    </Page>
  );
}
