import { canManageTarget, roleCan } from "@repo/contracts/identity";
import { authClient } from "@repo/shell/auth-client";
import { WORKSPACE_URL } from "@repo/shell/urls";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@repo/ui/components/native-select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { Fragment, type ReactNode, useCallback, useState } from "react";

import { announce, write } from "../lib/api";
import {
  type Directory,
  directoryQueryOptions,
  removePosition,
  savePosition,
} from "../lib/directory";
import { type Person, refreshPeople } from "../lib/people";
import {
  EditPersonDialog,
  ResetPasswordDialog,
  SuspendPersonDialog,
} from "./person-admin-dialogs";

const shellRoute = getRouteApi("/_shell");

export type PersonAction =
  | "delete"
  | "edit"
  | "impersonate"
  | "password"
  | "restore"
  | "sessions"
  | "suspend";

/**
 * Every act a person can be the object of, in the order and groups every
 * surface offers them.
 */
const ACTION_GROUPS: readonly (readonly PersonAction[])[] = [
  ["edit"],
  ["password", "sessions", "impersonate"],
  ["suspend", "restore", "delete"],
];

/** Each a verb naming its effect on them ("Revoke all sessions", not "Clear"). */
export const ACTION_LABELS: Record<PersonAction, string> = {
  delete: "Delete account",
  edit: "Edit account",
  impersonate: "Impersonate",
  password: "Issue new password",
  restore: "Restore access",
  sessions: "Revoke all sessions",
  suspend: "Suspend access",
};

export const DESTRUCTIVE = new Set<PersonAction>(["delete", "suspend"]);

export type PersonAdmin = ReturnType<typeof usePersonAdmin>;

/**
 * What the operator in front of us may do to this person, and the machinery to
 * do it.
 *
 * One hook rather than one component because two surfaces offer the same acts:
 * the People row's ⋯ menu, and the person page. A page you can read but not
 * act from sends you back to the menu you just left.
 */
export function usePersonAdmin(person: Person) {
  const { session } = shellRoute.useRouteContext();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PersonAction | null>(null);

  const role = session?.user?.role;
  const isSelf = session?.user?.id === person.id;

  // The server's target hierarchy: only break-glass may act on another
  // privileged account. Reviewers are read-only; helpdesk can reset a standard
  // account and revoke its sessions, but cannot edit or suspend it.
  const targetIsManageable = canManageTarget(role, person.role);
  const suspended = Boolean(person.banned);
  const canSuspend =
    roleCan(role, "user", "ban") && targetIsManageable && !isSelf;
  const allowed: Record<PersonAction, boolean> = {
    delete: roleCan(role, "user", "delete") && !isSelf,
    edit: roleCan(role, "user", "update") && targetIsManageable,
    impersonate: roleCan(role, "user", "impersonate") && !isSelf,
    password:
      roleCan(role, "user", "set-password") && targetIsManageable && !isSelf,
    restore: canSuspend && suspended,
    sessions:
      roleCan(role, "session", "revoke") && targetIsManageable && !isSelf,
    suspend: canSuspend && !suspended,
  };

  const refresh = useCallback(() => refreshPeople(queryClient), [queryClient]);

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
          label: ACTION_LABELS.sessions,
          run: () => revoke.mutate(),
          destructive: true,
        }
      : pending === "restore"
        ? {
            title: "Restore access?",
            description: `${person.email} will be able to sign in again.`,
            label: ACTION_LABELS.restore,
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
                label: ACTION_LABELS.delete,
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
        canAssignSuperAdmin={roleCan(role, "user", "set-role")}
        canChangeRole={roleCan(role, "user", "set-role") && !isSelf}
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
    dialogs,
    /** Every act this operator may take on this person, in menu order. */
    offered: ACTION_GROUPS.flat().filter((action) => allowed[action]),
    offers: (action: PersonAction) => allowed[action],
    request: setPending,
  };
}

/** These acts as menu groups, in menu order; `children` leads the first. */
export function PersonActionItems({
  actions,
  admin,
  children,
}: {
  actions: readonly PersonAction[];
  admin: PersonAdmin;
  children?: ReactNode;
}) {
  const groups = ACTION_GROUPS.map((group, index) => [
    ...(index === 0 && children
      ? [<Fragment key="leading">{children}</Fragment>]
      : []),
    ...group
      .filter((action) => actions.includes(action))
      .map((action) => (
        <DropdownMenuItem
          key={action}
          onClick={() => admin.request(action)}
          variant={DESTRUCTIVE.has(action) ? "destructive" : undefined}
        >
          {ACTION_LABELS[action]}
        </DropdownMenuItem>
      )),
  ]).filter((items) => items.length > 0);

  return groups.map((items, index) => (
    <Fragment key={index}>
      {index > 0 ? <DropdownMenuSeparator /> : null}
      <DropdownMenuGroup>{items}</DropdownMenuGroup>
    </Fragment>
  ));
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
  positions: Directory["positions"];
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
  positions: Directory["positions"];
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
