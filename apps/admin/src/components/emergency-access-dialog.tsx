import { type PermissionDefinition } from "@repo/contracts/access-control";
import { ACCESS_WINDOWS } from "@repo/contracts/identity";
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
import { Label } from "@repo/ui/components/label";
import { NativeSelectOption } from "@repo/ui/components/native-select";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { announce } from "../lib/api";
import {
  activateEmergencyAccess,
  emergencyAccessQueryOptions,
  endEmergencyAccess,
} from "../lib/business-access";
import { SurfaceBanner } from "./admin-surface";
import { FieldSelect } from "./business-access";

export function EmergencyAccessDialog({
  open,
  permissions,
  subsidiaries,
  teams,
  onOpenChange,
}: {
  open: boolean;
  permissions: PermissionDefinition[];
  subsidiaries: { id: string; name: string }[];
  teams: { id: string; name: string; organizationId: string }[];
  onOpenChange: (open: boolean) => void;
}) {
  const [permission, setPermission] = useState(permissions[0]?.key ?? "");
  const [organizationId, setOrganizationId] = useState("");
  const [scope, setScope] = useState<"subsidiary" | "team">("team");
  const [teamId, setTeamId] = useState("");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const elevations = useQuery({
    ...emergencyAccessQueryOptions,
    enabled: open,
    staleTime: 0,
    refetchInterval: open ? 1_000 : false,
  });
  const active = elevations.data?.[0] ?? null;
  const selectedPermission = permissions.find(
    (item) => item.key === permission,
  );
  const activate = useMutation({
    mutationFn: () =>
      activateEmergencyAccess({
        organizationId,
        permission,
        reason,
        scope,
        teamId: scope === "team" ? teamId : null,
      }),
    onError: announce.failed,
    onSuccess: async () => {
      await queryClient.invalidateQueries(emergencyAccessQueryOptions);
      announce.done(
        `Emergency access active for ${ACCESS_WINDOWS.breakGlassMinutes} minutes`,
      );
    },
  });
  const end = useMutation({
    mutationFn: () => endEmergencyAccess(active?.id ?? ""),
    onError: announce.failed,
    onSuccess: async () => {
      await queryClient.invalidateQueries(emergencyAccessQueryOptions);
      announce.done("Emergency access ended");
      onOpenChange(false);
    },
  });
  const availableTeams = useMemo(
    () => teams.filter((team) => team.organizationId === organizationId),
    [organizationId, teams],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="gap-2 flex items-center">
            <ShieldAlertIcon
              aria-hidden="true"
              className="size-4 text-status-warning-text"
              strokeWidth={1.5}
            />
            <DialogTitle>Emergency access</DialogTitle>
          </div>
          <DialogDescription>
            Use this only when the normal assignment path cannot resolve an
            urgent problem. The reason and every use are recorded.
          </DialogDescription>
        </DialogHeader>
        {elevations.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {elevations.error.message}
          </p>
        ) : null}
        {active ? (
          <SurfaceBanner tone="warn">
            <p className="font-medium text-[13px] text-foreground">
              Emergency access is active
            </p>
            <p className="mt-1">
              It ends at {new Date(active.expiresAt).toLocaleTimeString()} or
              when you end it now.
            </p>
            <p className="mt-1">{active.reason}</p>
            <p className="mt-1">
              {permissions.find((item) => item.key === active.permission)
                ?.label ?? active.permission}
              {" · "}
              {subsidiaries.find((item) => item.id === active.organizationId)
                ?.name ?? active.organizationId}
              {active.teamId
                ? ` / ${teams.find((item) => item.id === active.teamId)?.name ?? active.teamId}`
                : " (all teams)"}
            </p>
          </SurfaceBanner>
        ) : (
          <div className="gap-4 grid">
            <FieldSelect
              label="Permission"
              value={permission}
              onChange={setPermission}
            >
              {permissions.map((item) => (
                <NativeSelectOption key={item.key} value={item.key}>
                  {item.label}
                </NativeSelectOption>
              ))}
            </FieldSelect>
            <FieldSelect
              label="Subsidiary"
              value={organizationId}
              onChange={(value) => {
                setOrganizationId(value);
                setTeamId("");
              }}
            >
              <NativeSelectOption value="">
                Choose a subsidiary
              </NativeSelectOption>
              {subsidiaries.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}
                </NativeSelectOption>
              ))}
            </FieldSelect>
            <FieldSelect
              label="Scope"
              value={scope}
              onChange={(value) => setScope(value as "subsidiary" | "team")}
            >
              {selectedPermission?.scopes.includes("subsidiary") ? (
                <NativeSelectOption value="subsidiary">
                  Subsidiary and all teams
                </NativeSelectOption>
              ) : null}
              {selectedPermission?.scopes.includes("team") ? (
                <NativeSelectOption value="team">One team</NativeSelectOption>
              ) : null}
            </FieldSelect>
            {scope === "team" ? (
              <FieldSelect label="Team" value={teamId} onChange={setTeamId}>
                <NativeSelectOption value="">Choose a team</NativeSelectOption>
                {availableTeams.map((team) => (
                  <NativeSelectOption key={team.id} value={team.id}>
                    {team.name}
                  </NativeSelectOption>
                ))}
              </FieldSelect>
            ) : null}
            <div className="gap-2 grid">
              <Label htmlFor="emergency-reason">Reason</Label>
              <Textarea
                id="emergency-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="What is blocked, and why can it not wait for a normal assignment?"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          {active ? (
            <Button
              disabled={end.isPending}
              onClick={() => end.mutate()}
              size="sm"
              variant="destructive"
            >
              End emergency access
            </Button>
          ) : (
            <>
              <Button
                disabled={
                  activate.isPending ||
                  elevations.isPending ||
                  elevations.isError ||
                  !permission ||
                  !organizationId ||
                  !reason.trim() ||
                  (scope === "team" && !teamId)
                }
                onClick={() => activate.mutate()}
                size="sm"
                variant="destructive"
              >
                {activate.isPending
                  ? "Activating…"
                  : `Activate for ${ACCESS_WINDOWS.breakGlassMinutes} minutes`}
              </Button>
              <DialogClose render={<Button size="sm" variant="outline" />}>
                Close
              </DialogClose>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
