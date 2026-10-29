import { AppTrail, Page } from "@repo/shell/app-shell";
import { authClient } from "@repo/shell/auth-client";
import { domains } from "@repo/shell/domains";
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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Failed, Mark, Nothing, PANEL } from "../../components/admin-surface";
import type { Directory, Person } from "../../lib/admin";
import {
  announce,
  bindTeamDomain,
  teamDomainBindingsQueryOptions,
  directoryQueryOptions,
  coreWriteDocument,
  inSubsidiary,
  everyPersonQueryOptions,
  write,
} from "../../lib/admin";

export const Route = createFileRoute("/_shell/subsidiaries")({
  validateSearch: (search: Record<string, unknown>): { id?: string } =>
    typeof search.id === "string" ? { id: search.id } : {},
  component: Subsidiaries,
});

const shellRoute = getRouteApi("/_shell");

function Subsidiaries() {
  const { id } = Route.useSearch();
  const { session } = shellRoute.useRouteContext();
  const directory = useQuery(directoryQueryOptions);
  const people = useQuery(everyPersonQueryOptions);

  const subsidiaries = directory.data?.subsidiaries ?? [];
  // One company at a time: the panel is the list, so the page is the detail.
  // An unscoped visit lands on the first, which the panel marks as current.
  const shown = subsidiaries.find((one) => one.id === id) ?? subsidiaries[0];
  const teams = (directory.data?.teams ?? []).filter(
    (team) => team.organizationId === shown?.id,
  );
  const roles = (session?.user?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const canManage = roles.includes("admin") || roles.includes("super-admin");
  const canCreateSubsidiary = roles.includes("super-admin");

  return (
    <Page
      actions={
        <div className="gap-2 flex">
          {canCreateSubsidiary ? <CreateSubsidiary /> : null}
          {canManage && shown ? <CreateTeam organizationId={shown.id} /> : null}
        </div>
      }
      breadcrumb={
        <AppTrail
          items={
            shown
              ? [
                  { label: "Subsidiaries", to: "/subsidiaries" },
                  { label: shown.name },
                ]
              : [{ label: "Subsidiaries" }]
          }
        />
      }
      description={
        shown
          ? "Team membership decides which domains appear in each workspace."
          : "Operating companies in the group."
      }
      footer={
        shown ? (
          <span className="tabular-nums">
            {teams.length === 1 ? "1 team" : `${teams.length} teams`}
          </span>
        ) : null
      }
      title={shown?.name ?? "Subsidiaries"}
    >
      {directory.isPending ? (
        <div className="gap-3 flex flex-col">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24" />
        </div>
      ) : shown ? (
        <TeamList
          canManage={canManage}
          directory={directory.data}
          organizationId={shown.id}
          people={people.data ?? []}
          subsidiaryMemberIds={shown.memberIds}
        />
      ) : directory.isError ? (
        <Failed
          error={directory.error}
          onRetry={() => void directory.refetch()}
          what="group"
        />
      ) : (
        <Nothing title="No subsidiaries yet">
          {canCreateSubsidiary
            ? "Create the first subsidiary to start adding teams and assigning domain access."
            : "A super administrator must create the first subsidiary before teams and domain access can be managed."}
        </Nothing>
      )}
    </Page>
  );
}

function CreateSubsidiary() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const create = useMutation({
    mutationFn: () =>
      coreWriteDocument(
        "/api/auth-management/subsidiaries",
        { name, slug },
        "Could not create the subsidiary.",
      ),
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`${name} created`);
      setOpen(false);
      setName("");
      setSlug("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "directory"] });
    },
  });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            New subsidiary
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New subsidiary</DialogTitle>
          <DialogDescription>
            Create a subsidiary, then add the teams that control domain access.
          </DialogDescription>
        </DialogHeader>
        <form
          className="gap-4 grid"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <label className="gap-1.5 text-xs grid">
            Name
            <Input
              autoFocus
              required
              value={name}
              onChange={(event) => {
                const next = event.target.value;
                setName(next);
                setSlug(
                  next
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
              }}
            />
          </label>
          <label className="gap-1.5 text-xs grid">
            Slug
            <Input
              required
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </label>
          <DialogFooter>
            <Button disabled={create.isPending} size="sm" type="submit">
              {create.isPending ? "Creating…" : "Create subsidiary"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateTeam({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () =>
      coreWriteDocument(
        `/api/auth-management/subsidiaries/${organizationId}/teams`,
        { name },
        "Could not create the team.",
      ),
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`${name} created`);
      setOpen(false);
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "directory"] });
    },
  });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button size="sm">New team</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New team</DialogTitle>
          <DialogDescription>
            After creating the team, link it to a domain to grant workspace
            admission.
          </DialogDescription>
        </DialogHeader>
        <form
          className="gap-4 grid"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <label className="gap-1.5 text-xs grid">
            Team name
            <Input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <DialogFooter>
            <Button disabled={create.isPending} size="sm" type="submit">
              {create.isPending ? "Creating…" : "Create team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeamList({
  canManage,
  directory,
  organizationId,
  people,
  subsidiaryMemberIds,
}: {
  canManage: boolean;
  directory?: Directory;
  organizationId: string;
  people: Person[];
  subsidiaryMemberIds: string[];
}) {
  const teams = (directory?.teams ?? []).filter(
    (team) => team.organizationId === organizationId,
  );

  if (teams.length === 0) {
    return (
      <Nothing title="No teams yet">
        {canManage
          ? "Create a team to assign domain access."
          : "An identity administrator must create one before domain access can be assigned."}
      </Nothing>
    );
  }

  return (
    <div className="gap-4 flex flex-col">
      {teams.map((team) => (
        <TeamRow
          canManage={canManage}
          key={team.id}
          memberIds={team.memberIds}
          name={team.name}
          organizationId={organizationId}
          people={people}
          subsidiaryMemberIds={subsidiaryMemberIds}
          teamId={team.id}
        />
      ))}
    </div>
  );
}

function TeamRow({
  canManage,
  memberIds,
  name,
  organizationId,
  people,
  subsidiaryMemberIds,
  teamId,
}: {
  canManage: boolean;
  memberIds: string[];
  name: string;
  organizationId: string;
  people: Person[];
  subsidiaryMemberIds: string[];
  teamId: string;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState("");
  const bindings = useQuery(teamDomainBindingsQueryOptions);
  const domainSlug =
    bindings.data?.find((binding) => binding.teamId === teamId)?.domainSlug ??
    null;
  const link = useMutation({
    mutationFn: (slug: string | null) => bindTeamDomain(teamId, slug),
    onError: announce.failed,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: teamDomainBindingsQueryOptions.queryKey,
      });
      announce.done("Team domain updated");
    },
  });

  const roster = people.filter((person) => memberIds.includes(person.id));
  const outsiders = people.filter((person) => !memberIds.includes(person.id));

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "directory"] });

  const add = useMutation({
    mutationFn: (userId: string) =>
      subsidiaryMemberIds.includes(userId)
        ? inSubsidiary(
            organizationId,
            () => authClient.organization.addTeamMember({ teamId, userId }),
            `Could not add them to ${name}.`,
          )
        : write(
            () =>
              coreWriteDocument(
                `/api/auth-management/subsidiaries/${organizationId}/members`,
                {
                  organizationId,
                  role: "member",
                  teamId,
                  userId,
                },
                `Could not add them to ${name}.`,
              ).then((data) => ({ data })),
            `Could not add them to ${name}.`,
          ),
    onError: announce.failed,
    onSuccess: () => {
      setAdding("");
      announce.done(`Added to ${name}`);
      void refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (userId: string) =>
      inSubsidiary(
        organizationId,
        () => authClient.organization.removeTeamMember({ teamId, userId }),
        `Could not remove them from ${name}.`,
      ),
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`Removed from ${name}`);
      void refresh();
    },
  });

  const domainLabel =
    domains.find((domain) => domain.slug === domainSlug)?.label ?? null;

  return (
    <section aria-label={name} className={PANEL}>
      <header className="gap-3 px-4 py-3 flex flex-wrap items-center justify-between border-b border-border">
        <div className="min-w-0">
          <h2 className="font-medium truncate text-[13px] text-foreground">
            {name}
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
            {roster.length === 1 ? "1 member" : `${roster.length} members`}
          </p>
        </div>
        {canManage ? (
          <label className="gap-2 flex items-center text-[12px] text-muted-foreground">
            Grants
            <Select
              items={[
                { label: "No domain", value: "none" },
                ...domains.map((domain) => ({
                  label: domain.label,
                  value: domain.slug,
                })),
              ]}
              value={domainSlug ?? "none"}
              onValueChange={(value) => {
                if (value) link.mutate(value === "none" ? null : value);
              }}
              disabled={
                bindings.isPending || bindings.isError || link.isPending
              }
            >
              <SelectTrigger
                aria-label={`Domain for ${name}`}
                className="w-40"
                size="sm"
              >
                <SelectValue placeholder="Choose domain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No domain</SelectItem>
                {domains.map((domain) => (
                  <SelectItem key={domain.slug} value={domain.slug}>
                    {domain.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : (
          <Mark
            label={
              bindings.isError
                ? "Domain unavailable"
                : (domainLabel ?? "No domain")
            }
            tone={domainSlug ? "done" : "warn"}
          />
        )}
      </header>

      {roster.length > 0 ? (
        <ul className="divide-y divide-border">
          {roster.map((person) => {
            const named = person.name && person.name !== person.email;
            return (
              <li
                className="gap-3 px-4 py-2.5 flex items-center"
                key={person.id}
              >
                <Avatar size="sm">
                  <AvatarFallback>
                    {(person.name || person.email)
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="font-medium block truncate text-[13px] text-foreground">
                    {named ? person.name : person.email}
                  </span>
                  {named ? (
                    <span className="font-mono block truncate text-[11px] text-muted-foreground">
                      {person.email}
                    </span>
                  ) : null}
                </span>
                {canManage ? (
                  <RemoveMember
                    email={person.email}
                    onRemove={() => remove.mutate(person.id)}
                    team={name}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
          {domainLabel
            ? `Nobody here yet. Members will see ${domainLabel} in their workspace.`
            : "Nobody here yet."}
        </p>
      )}

      {canManage && outsiders.length > 0 ? (
        <footer className="px-4 py-2.5 border-t border-border">
          <Select
            onValueChange={(userId) => {
              if (userId) add.mutate(userId);
            }}
            value={adding}
          >
            <SelectTrigger
              aria-label={`Add someone to ${name}`}
              className="w-56 border-dashed"
              disabled={add.isPending}
              size="sm"
            >
              <PlusIcon aria-hidden="true" strokeWidth={1.5} />
              <SelectValue placeholder="Add someone" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {outsiders.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.email}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </footer>
      ) : null}
    </section>
  );
}

/**
 * Team membership controls workspace admission. Business permissions are
 * managed under Business access so the two facts cannot be confused.
 */
function RemoveMember({
  email,
  onRemove,
  team,
}: {
  email: string;
  onRemove: () => void;
  team: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button
        aria-label={`Remove ${email} from ${team}`}
        data-tone="muted"
        onClick={() => setConfirming(true)}
        size="icon-xs"
        variant="ghost"
      >
        <XIcon aria-hidden="true" strokeWidth={1.5} />
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from {team}?</AlertDialogTitle>
            <AlertDialogDescription>
              {email} will lose the domain access granted by this team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRemove();
                setConfirming(false);
              }}
              size="sm"
              variant="destructive"
            >
              Remove from {team}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
