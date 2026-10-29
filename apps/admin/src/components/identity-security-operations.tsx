import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

import {
  announce,
  coreMutationDocument,
  everyPersonQueryOptions,
  factorRecoveryQueryOptions,
  securityOperationFailed,
  type Person,
  type FactorRecoveryRequest,
  type OnboardingOutcome,
} from "../lib/admin";
import {
  Failed,
  Mark,
  Nothing,
  PanelSkeleton,
  SurfaceSection,
} from "./admin-surface";
import { TemporaryPassword } from "./temporary-password";

const shellRoute = getRouteApi("/_shell");

export function IdentitySecurityOperations({ person }: { person: Person }) {
  const { session } = shellRoute.useRouteContext();
  const roles = (session?.user?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const [mode, setMode] = useState<"recovery" | "offboard" | null>(null);
  const other = person.id !== session?.user?.id;
  const canRequest =
    other &&
    !person.banned &&
    roles.some((role) => ["helpdesk", "admin", "super-admin"].includes(role));
  const targetPrivileged = (person.role ?? "")
    .split(",")
    .some((role) =>
      ["helpdesk", "access-reviewer", "admin", "super-admin"].includes(
        role.trim(),
      ),
    );
  const canOffboard =
    other &&
    !person.banned &&
    (roles.includes("super-admin") ||
      (roles.includes("admin") && !targetPrivileged));
  if (!canRequest && !canOffboard) return null;
  return (
    <div className="gap-2 flex flex-wrap">
      {canRequest ? (
        <Button size="sm" variant="outline" onClick={() => setMode("recovery")}>
          Request factor recovery
        </Button>
      ) : null}
      {canOffboard ? (
        <Button size="sm" variant="outline" onClick={() => setMode("offboard")}>
          Offboard employee
        </Button>
      ) : null}
      {mode ? (
        <SecurityOperationDialog
          person={person}
          mode={mode}
          onClose={() => setMode(null)}
        />
      ) : null}
    </div>
  );
}

function SecurityOperationDialog({
  person,
  mode,
  onClose,
}: {
  person: Person;
  mode: "recovery" | "offboard";
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [verified, setVerified] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      coreMutationDocument(
        `/api/auth-management/users/${person.id}/${mode === "recovery" ? "factor-recovery" : "offboard"}`,
        "POST",
        { reason, evidence, identityVerified: verified },
        "Could not complete the security operation.",
      ),
    onError: securityOperationFailed,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin"] });
      announce.done(
        mode === "recovery"
          ? "Recovery requested; independent approval required"
          : "Employee offboarded",
      );
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "recovery"
              ? "Request factor recovery"
              : "Offboard employee"}
          </DialogTitle>
          <DialogDescription>
            {mode === "recovery"
              ? `For ${person.email}. A different super administrator must verify and approve. Approval removes all existing factors and sessions, and issues a temporary password.`
              : `Suspend ${person.email}, revoke sessions and business grants, remove memberships and clear identity privileges. The account and audit history are retained.`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="gap-4 grid"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="gap-1.5 text-xs grid">
            Reason and case reference
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={10}
              maxLength={500}
            />
          </label>
          {mode === "recovery" ? (
            <>
              <label className="gap-1.5 text-xs grid">
                Identity verification evidence
                <Textarea
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                  required
                  minLength={10}
                  maxLength={500}
                  placeholder="Established callback channel, manager confirmation and case reference. No secrets or identity documents."
                />
              </label>
              <label className="gap-2 text-sm flex items-center">
                <Checkbox
                  checked={verified}
                  onCheckedChange={(checked) => setVerified(checked === true)}
                />
                I verified identity through established company channels.
              </label>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Confirm HR authorization before proceeding. Restoring the account
              later will require new memberships and business grants.
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={mode === "offboard" ? "destructive" : "default"}
              disabled={
                save.isPending ||
                reason.trim().length < 10 ||
                (mode === "recovery" &&
                  (!verified || evidence.trim().length < 10))
              }
            >
              {save.isPending
                ? "Saving…"
                : mode === "recovery"
                  ? "Request recovery"
                  : "Offboard employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FactorRecoveryQueue() {
  const { session } = shellRoute.useRouteContext();
  const requests = useQuery(factorRecoveryQueryOptions);
  const people = useQuery(everyPersonQueryOptions);
  const [selected, setSelected] = useState<FactorRecoveryRequest | null>(null);
  const superAdmin = (session?.user?.role ?? "")
    .split(",")
    .some((role) => role.trim() === "super-admin");
  if (requests.isPending || people.isPending) return <PanelSkeleton rows={2} />;
  const error = requests.error || people.error;
  if (error)
    return (
      <Failed
        what="factor recovery requests"
        error={error}
        onRetry={() => {
          void requests.refetch();
          void people.refetch();
        }}
      />
    );
  return (
    <SurfaceSection
      framed={false}
      title="Factor recovery"
      description="Independent identity verification and super-administrator approval are required. Pending requests expire after one hour."
    >
      {!requests.data?.length ? (
        <Nothing framed={false} title="No factor recovery requests" />
      ) : (
        <ul className="px-3 py-1">
          {requests.data.map((row) => {
            const expired = row.expired;
            const canApprove =
              superAdmin &&
              row.requestedBy &&
              row.requestedBy !== session?.user?.id &&
              row.userId !== session?.user?.id;
            return (
              <li
                key={row.id}
                className="row-hover gap-3 flex flex-wrap items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[13px]">
                    {people.data?.find((person) => person.id === row.userId)
                      ?.email ?? row.userId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.reason} · {row.evidence}
                  </p>
                </div>
                {row.completedAt ? (
                  <Mark label="Completed" tone="done" />
                ) : expired ? (
                  <Mark label="Expired" tone="away" />
                ) : canApprove ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(row)}
                  >
                    Verify and approve
                  </Button>
                ) : (
                  <Mark label="Needs another approver" tone="away" />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {selected ? (
        <RecoveryApproval
          request={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </SurfaceSection>
  );
}

function RecoveryApproval({
  request,
  onClose,
}: {
  request: FactorRecoveryRequest;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [evidence, setEvidence] = useState("");
  const [verified, setVerified] = useState(false);
  const approve = useMutation({
    gcTime: 0,
    mutationFn: () =>
      coreMutationDocument<{
        temporaryPassword: string;
        onboarding: OnboardingOutcome;
      }>(
        `/api/auth-management/recoveries/${request.id}/approve`,
        "POST",
        { evidence, identityVerified: verified },
        "Could not approve recovery.",
      ),
    onError: (error) => {
      void client.invalidateQueries({
        queryKey: factorRecoveryQueryOptions.queryKey,
      });
      securityOperationFailed(error);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !approve.isPending) onClose();
      }}
    >
      <DialogContent>
        {approve.data ? (
          <>
            <DialogHeader>
              <DialogTitle>Factors replaced</DialogTitle>
              <DialogDescription>
                {approve.data.onboarding.queued
                  ? `A temporary password was queued to ${approve.data.onboarding.destination}.`
                  : "Delivery was not queued. Share this temporary password through a separately verified channel."}{" "}
                All old sessions and factors were revoked. The employee must
                replace the password and enroll MFA again before privileged
                access.
              </DialogDescription>
            </DialogHeader>
            <TemporaryPassword password={approve.data.temporaryPassword} />
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Verify and approve recovery</DialogTitle>
              <DialogDescription>
                Verify identity independently of the requester. Approval
                replaces the password and removes all existing passkeys,
                authenticators, recovery codes, trusted-device records and
                sessions.
              </DialogDescription>
            </DialogHeader>
            <form
              className="gap-4 grid"
              onSubmit={(event) => {
                event.preventDefault();
                approve.mutate();
              }}
            >
              <label className="gap-1.5 text-xs grid">
                Independent verification evidence
                <Textarea
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                  required
                  minLength={10}
                  maxLength={500}
                  placeholder="Established callback channel and case reference. No secrets."
                />
              </label>
              <label className="gap-2 text-sm flex items-center">
                <Checkbox
                  checked={verified}
                  onCheckedChange={(checked) => setVerified(checked === true)}
                />
                I independently verified the account holder's identity.
              </label>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={approve.isPending}
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    approve.isPending ||
                    !verified ||
                    evidence.trim().length < 10
                  }
                >
                  {approve.isPending
                    ? "Approving…"
                    : "Approve and replace factors"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
