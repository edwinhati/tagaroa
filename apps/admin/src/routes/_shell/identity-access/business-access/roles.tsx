import { isSuperAdmin, mayRun } from "@repo/contracts/identity";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

import {
  COLUMN,
  Failed,
  Mark,
  MONO,
  PANEL,
  SurfaceSection,
} from "../../../../components/admin-surface";
import { BusinessAccessPage } from "../../../../components/business-access";
import {
  announce,
  archiveBusinessRole,
  businessAccessPolicyQueryOptions,
  createBusinessRole,
  type BusinessPermission,
  type BusinessRole,
  updateBusinessRole,
} from "../../../../lib/admin";

const shellRoute = getRouteApi("/_shell");

export const Route = createFileRoute(
  "/_shell/identity-access/business-access/roles",
)({
  component: RolesPage,
});

function RolesPage() {
  const { session } = shellRoute.useRouteContext();
  const policy = useQuery(businessAccessPolicyQueryOptions);
  const superAdmin = isSuperAdmin(session?.user?.role);
  const canAssign = mayRun(session?.user?.role, "administer");
  const [editingRole, setEditingRole] = useState<BusinessRole | null | "new">(
    null,
  );

  return (
    <BusinessAccessPage
      actions={
        <>
          {superAdmin ? (
            <Button onClick={() => setEditingRole("new")} size="sm">
              Create role
            </Button>
          ) : null}
          {!canAssign ? <Mark label="Read only" tone="waiting" /> : null}
        </>
      }
    >
      <SurfaceSection
        className="mt-4"
        title="Role library"
        trailing={
          !superAdmin ? <Mark label="Read only" tone="waiting" /> : null
        }
      >
        {policy.isPending ? (
          <div className="gap-2 p-3.5 flex flex-col" aria-hidden="true">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : policy.isError || !policy.data ? (
          <Failed
            error={
              policy.error ?? { message: "Could not read business roles." }
            }
            framed={false}
            onRetry={() => void policy.refetch()}
            what="business roles"
          />
        ) : (
          <div
            className="roles-hier relative"
            role="region"
            aria-label="Business role library"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th className={COLUMN} scope="col">
                    Role
                  </th>
                  <th className={COLUMN} scope="col">
                    Permissions
                  </th>
                  <th className={COLUMN} scope="col">
                    Assignments
                  </th>
                  <th className={COLUMN} scope="col">
                    Access level
                  </th>
                  <th className="roles-hier-actions" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {policy.data.roles.map((role) => (
                  <tr key={role.id}>
                    <td className="roles-hier-role">
                      <p className="roles-hier-name">{role.name}</p>
                      <p
                        className={`roles-hier-key ${MONO} text-muted-foreground`}
                      >
                        {role.key}
                      </p>
                      <p className="roles-hier-desc">{role.description}</p>
                    </td>
                    <td className="roles-hier-perm">
                      {role.permissions
                        .map(
                          (permission) =>
                            policy.data.permissions.find(
                              (item) => item.key === permission,
                            )?.label ?? permission,
                        )
                        .join(", ")}
                    </td>
                    <td className="roles-hier-count">{role.assignmentCount}</td>
                    <td>
                      <div className="roles-hier-marks">
                        {role.archivedAt ? (
                          <Mark label="Archived" tone="quiet" />
                        ) : null}
                        {role.system ? (
                          <Mark label="Built in" tone="quiet" />
                        ) : null}
                        <Mark
                          label={role.privileged ? "Privileged" : "Standard"}
                          tone={role.privileged ? "away" : "quiet"}
                        />
                      </div>
                    </td>
                    <td className="roles-hier-actions">
                      {superAdmin && !role.system && !role.archivedAt ? (
                        <div className="gap-1 flex justify-end whitespace-nowrap">
                          <Button
                            onClick={() => setEditingRole(role)}
                            size="sm"
                            variant="ghost"
                          >
                            Edit role
                          </Button>
                          <ArchiveRoleButton role={role} />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceSection>

      {policy.data ? (
        <RoleEditor
          open={editingRole !== null}
          permissions={policy.data.permissions}
          role={editingRole === "new" ? null : editingRole}
          onOpenChange={(open) => !open && setEditingRole(null)}
        />
      ) : null}
    </BusinessAccessPage>
  );
}

function ArchiveRoleButton({ role }: { role: BusinessRole }) {
  const queryClient = useQueryClient();
  const archive = useMutation({
    mutationFn: () => archiveBusinessRole(role.id),
    onError: announce.failed,
    onSuccess: () => {
      announce.done("Role archived");
      void queryClient.invalidateQueries({
        queryKey: businessAccessPolicyQueryOptions.queryKey,
      });
    },
  });
  return (
    <Button
      disabled={role.assignmentCount > 0 || archive.isPending}
      onClick={() => archive.mutate()}
      size="sm"
      title={
        role.assignmentCount > 0
          ? "Revoke this role's assignments before archiving it."
          : undefined
      }
      variant="ghost"
    >
      Archive
    </Button>
  );
}

function RoleEditor({
  open,
  permissions,
  role,
  onOpenChange,
}: {
  open: boolean;
  permissions: BusinessPermission[];
  role: BusinessRole | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(role?.name ?? "");
  const [key, setKey] = useState(role?.key ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const save = useMutation({
    mutationFn: () =>
      role
        ? updateBusinessRole(role.id, {
            description,
            name,
            permissions: selected,
          })
        : createBusinessRole({ description, key, name, permissions: selected }),
    onError: announce.failed,
    onSuccess: () => {
      announce.done(role ? "Role updated" : "Role created");
      void queryClient.invalidateQueries({
        queryKey: businessAccessPolicyQueryOptions.queryKey,
      });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {role ? `Edit ${role.name}` : "Create a business role"}
          </DialogTitle>
          <DialogDescription>
            Every assignment using this role changes as soon as you save it.
            Sensitive changes may ask you to sign in again.
          </DialogDescription>
        </DialogHeader>
        <div className="gap-4 grid">
          <div className="gap-2 grid">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              onChange={(event) => {
                const value = event.target.value;
                setName(value);
                if (!role) {
                  setKey(
                    value
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  );
                }
              }}
              value={name}
            />
          </div>
          {!role ? (
            <div className="gap-2 grid">
              <Label htmlFor="role-key">Stable key</Label>
              <Input
                id="role-key"
                className="font-mono"
                onChange={(event) => setKey(event.target.value)}
                value={key}
              />
            </div>
          ) : null}
          <div className="gap-2 grid">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </div>
          <fieldset className="gap-0 grid">
            <legend className={`${COLUMN} mb-2`}>Permissions</legend>
            <div className={`${PANEL} px-3 py-1`}>
              {permissions.map((permission) => {
                const checked = selected.includes(permission.key);
                return (
                  <label
                    className="row-hover gap-3 text-sm font-medium flex items-start leading-none select-none"
                    key={permission.key}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) =>
                        setSelected((current) =>
                          next
                            ? [...new Set([...current, permission.key])]
                            : current.filter((key) => key !== permission.key),
                        )
                      }
                    />
                    <span>
                      <span className="block text-[13px]">
                        {permission.label}
                      </span>
                      <span className="mt-0.5 font-normal block text-[12.5px] text-muted-foreground">
                        {permission.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {role && role.assignmentCount > 0 ? (
            <p className="text-[12.5px] text-muted-foreground">
              Saving updates {role.assignmentCount} existing assignment
              {role.assignmentCount === 1 ? "" : "s"} immediately.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={
              save.isPending ||
              !name.trim() ||
              !description.trim() ||
              selected.length === 0
            }
            onClick={() => save.mutate()}
            size="sm"
          >
            {save.isPending ? "Saving…" : "Save role"}
          </Button>
          <DialogClose render={<Button size="sm" variant="outline" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
