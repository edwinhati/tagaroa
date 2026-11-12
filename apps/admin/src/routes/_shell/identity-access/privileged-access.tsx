import {
  ACCESS_WINDOWS,
  isSuperAdmin,
  hasAnyRole,
  IDENTITY_ROLES,
  isPrivilegedRole,
  primaryRoleLabel,
} from "@repo/contracts/identity";
import { AppTrail, Page } from "@repo/shell/app-shell";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  COLUMN,
  Failed,
  Mark,
  MONO,
  SurfaceBanner,
  SurfaceSection,
  COLLECTION,
  FIGURE,
  PanelSkeleton,
} from "../../../components/admin-surface";
import { EmergencyAccessDialog } from "../../../components/emergency-access-dialog";
import { IdentityRoleDialog } from "../../../components/identity-role-dialog";
import { businessAccessPolicyQueryOptions } from "../../../lib/business-access";
import { directoryQueryOptions } from "../../../lib/directory";
import {
  everyPersonQueryOptions,
  type Person,
  accessPolicyQueryOptions,
} from "../../../lib/people";

export const Route = createFileRoute(
  "/_shell/identity-access/privileged-access",
)({
  component: PrivilegedAccess,
});

const shellRoute = getRouteApi("/_shell");

function PrivilegedAccess() {
  const { session } = shellRoute.useRouteContext();
  const policy = useQuery(accessPolicyQueryOptions);
  const businessPolicy = useQuery(businessAccessPolicyQueryOptions);
  const directory = useQuery(directoryQueryOptions);
  const people = useQuery(everyPersonQueryOptions);
  const superAdmin = isSuperAdmin(session?.user?.role);
  const [assigning, setAssigning] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const privilegedRoles = IDENTITY_ROLES.filter((role) => role.privileged);
  const holders = (people.data ?? []).filter((person) =>
    isPrivilegedRole(person.role),
  );

  return (
    <Page
      actions={
        superAdmin ? (
          <Button onClick={() => setAssigning(true)} size="sm">
            Assign identity role
          </Button>
        ) : (
          <Mark label="Read only" tone="waiting" />
        )
      }
      breadcrumb={
        <AppTrail
          items={[
            { label: "Identity & access", to: "/identity-access" },
            { label: "Privileged access" },
          ]}
        />
      }
      title="Privileged access"
    >
      {policy.isPending || people.isPending ? (
        <div className={COLLECTION}>
          <Skeleton className="h-5 max-w-md" />
          <PanelSkeleton rows={5} />
        </div>
      ) : policy.isError || people.isError ? (
        <Failed
          error={
            policy.error ??
            people.error ?? { message: "Unable to read privileged access." }
          }
          onRetry={() => {
            void policy.refetch();
            void people.refetch();
          }}
          what="privileged access"
        />
      ) : (
        <div className={COLLECTION}>
          <p className="gap-x-3 gap-y-1 flex flex-wrap items-baseline text-[12.5px] text-muted-foreground">
            <span>
              <span className={`${FIGURE} text-foreground`}>
                {privilegedRoles.length}
              </span>{" "}
              identity {privilegedRoles.length === 1 ? "role" : "roles"}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className={`${FIGURE} text-foreground`}>
                {holders.length}
              </span>{" "}
              {holders.length === 1 ? "holder" : "holders"}
            </span>
            <span aria-hidden="true">·</span>
            <span>Two-factor required</span>
          </p>

          <p className="text-[12.5px] text-muted-foreground">
            Privileged accounts require two-factor authentication. Devices can
            be trusted for {policy.data.session.trustedDeviceDays} days.
          </p>

          <SurfaceSection title="Identity roles">
            <div
              className="px-1 relative overflow-x-auto"
              role="region"
              aria-label="Identity role catalog"
              tabIndex={0}
            >
              <table className="register-table w-full min-w-[36rem] text-left text-[13px]">
                <thead>
                  <tr>
                    <th className={COLUMN} scope="col">
                      Role
                    </th>
                    <th className={COLUMN} scope="col">
                      Authority
                    </th>
                    <th className={COLUMN} scope="col">
                      Holders
                    </th>
                    <th className={COLUMN} scope="col">
                      Protection
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {privilegedRoles.map((role) => {
                    const roleHolders = (people.data ?? []).filter((person) =>
                      hasAnyRole(person.role, [role.id]),
                    );
                    return (
                      <tr key={role.id}>
                        <td>
                          <p className="font-medium text-foreground">
                            {role.label}
                          </p>
                          <p className={`${MONO} mt-0.5 text-muted-foreground`}>
                            {role.id}
                          </p>
                        </td>
                        <td className="max-w-xl text-muted-foreground">
                          {role.description}
                        </td>
                        <td className={FIGURE}>{roleHolders.length}</td>
                        <td>
                          <Mark label="Two-factor required" tone="done" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SurfaceSection>

          <SurfaceSection
            framed={false}
            title="Role holders"
            trailing={
              <span className={`${FIGURE} text-muted-foreground`}>
                {holders.length}
              </span>
            }
          >
            <RoleHolders people={people.data ?? []} />
          </SurfaceSection>

          {superAdmin ? (
            <SurfaceBanner tone="warn">
              <div className="gap-3 sm:flex-row sm:items-center flex flex-col justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    Emergency access
                  </p>
                  <p className="mt-1 leading-relaxed">
                    One permission for {ACCESS_WINDOWS.breakGlassMinutes}{" "}
                    minutes when a normal assignment cannot resolve an urgent
                    problem. Reason and use are recorded.
                  </p>
                </div>
                <Button
                  className="sm:self-center shrink-0 self-start"
                  onClick={() => setEmergency(true)}
                  size="sm"
                  variant="destructive"
                >
                  Request emergency access
                </Button>
              </div>
            </SurfaceBanner>
          ) : null}
        </div>
      )}

      {policy.data && people.data ? (
        <IdentityRoleDialog
          currentUserId={session?.user?.id ?? ""}
          onOpenChange={setAssigning}
          open={assigning}
          people={people.data}
          roles={IDENTITY_ROLES}
        />
      ) : null}
      {businessPolicy.data && directory.data ? (
        <EmergencyAccessDialog
          onOpenChange={setEmergency}
          open={emergency}
          permissions={businessPolicy.data.permissions.filter(
            (permission) => permission.breakGlass,
          )}
          subsidiaries={directory.data.subsidiaries}
          teams={directory.data.teams}
        />
      ) : null}
    </Page>
  );
}

function RoleHolders({ people }: { people: Person[] }) {
  const privileged = people.filter((person) => isPrivilegedRole(person.role));
  if (privileged.length === 0) {
    return (
      <p className="px-3.5 py-8 text-center text-[13px] text-muted-foreground">
        No privileged accounts
      </p>
    );
  }
  return (
    <ul className="gap-1.5 px-1.5 py-1 flex flex-col">
      {privileged.map((person) => {
        const initial = (person.name || person.email)
          .trim()
          .charAt(0)
          .toUpperCase();
        return (
          <li
            className="row-hover-bg gap-3 px-2 py-2 flex items-center rounded-md border border-border/70"
            key={person.id}
          >
            <Avatar size="sm">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 gap-0.5 flex flex-1 flex-col">
              <p className="font-medium truncate text-[13px]">
                {person.name || person.email}
              </p>
              <div className="gap-2 min-w-0 flex items-center">
                <p className={`${MONO} truncate text-muted-foreground`}>
                  {person.email}
                </p>
                <span aria-hidden="true" className="text-muted-foreground/50">
                  ·
                </span>
                <span className="truncate text-[12.5px] text-muted-foreground">
                  {primaryRoleLabel(person.role)}
                </span>
              </div>
            </div>
            <Button
              className="shrink-0"
              nativeButton={false}
              render={
                <Link
                  params={{ personId: person.id }}
                  to="/identity-access/people/$personId"
                />
              }
              size="sm"
              variant="ghost"
            >
              Review
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
