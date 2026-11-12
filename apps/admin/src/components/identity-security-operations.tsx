import {
  ACCESS_WINDOWS,
  canManageTarget,
  EVIDENCE_LENGTH,
  isSuperAdmin,
  mayRun,
} from "@repo/contracts/identity";
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
import { type ReactNode, useState } from "react";

import {
  announce,
  coreMutationDocument,
  everyPersonQueryOptions,
  factorRecoveryQueryOptions,
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
  const role = session?.user?.role;
  const [open, setOpen] = useState<"recovery" | "offboard" | null>(null);
  const other = person.id !== session?.user?.id;
  const canRequest = other && !person.banned && mayRun(role, "support");
  const canOffboard =
    other &&
    !person.banned &&
    mayRun(role, "administer") &&
    canManageTarget(role, person.role);
  if (!canRequest && !canOffboard) return null;
  const close = () => setOpen(null);
  return (
    <div className="gap-2 flex flex-wrap">
      {canRequest ? (
        <Button size="sm" variant="outline" onClick={() => setOpen("recovery")}>
          Request factor recovery
        </Button>
      ) : null}
      {canOffboard ? (
        <Button size="sm" variant="outline" onClick={() => setOpen("offboard")}>
          Offboard employee
        </Button>
      ) : null}
      {open === "recovery" ? (
        <RequestRecoveryDialog onClose={close} person={person} />
      ) : null}
      {open === "offboard" ? (
        <OffboardDialog onClose={close} person={person} />
      ) : null}
    </div>
  );
}

const hasEvidence = (text: string) => text.trim().length >= EVIDENCE_LENGTH.min;

/** A dialog that cannot be dismissed while its act is in flight. */
function OperationDialog({
  children,
  onClose,
  pending,
}: {
  children: ReactNode;
  onClose: () => void;
  pending: boolean;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>{children}</DialogContent>
    </Dialog>
  );
}

/** A case note put on record: a reason, or how identity was verified. */
function EvidenceText({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="gap-1.5 text-xs grid">
      {label}
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        minLength={EVIDENCE_LENGTH.min}
        maxLength={EVIDENCE_LENGTH.max}
        placeholder={placeholder}
      />
    </label>
  );
}

function VerifiedCheck({
  checked,
  children,
  onChange,
}: {
  checked: boolean;
  children: ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="gap-2 text-sm flex items-center">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onChange(next === true)}
      />
      {children}
    </label>
  );
}

function OperationFooter({
  disabled,
  onCancel,
  pending,
  pendingLabel,
  submitLabel,
  variant = "default",
}: {
  disabled: boolean;
  onCancel: () => void;
  pending: boolean;
  pendingLabel: string;
  submitLabel: string;
  variant?: "default" | "destructive";
}) {
  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onCancel}
      >
        Cancel
      </Button>
      <Button type="submit" variant={variant} disabled={pending || disabled}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </DialogFooter>
  );
}

/** One security act on a person, then the back office reads again. */
function usePersonOperation(
  person: Person,
  operation: "factor-recovery" | "offboard",
  done: string,
  onClose: () => void,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      coreMutationDocument(
        `/api/auth-management/users/${person.id}/${operation}`,
        "POST",
        body,
        "Could not complete the security operation.",
      ),
    onError: announce.failed,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin"] });
      announce.done(done);
      onClose();
    },
  });
}

function RequestRecoveryDialog({
  onClose,
  person,
}: {
  onClose: () => void;
  person: Person;
}) {
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [verified, setVerified] = useState(false);
  const request = usePersonOperation(
    person,
    "factor-recovery",
    "Recovery requested; independent approval required",
    onClose,
  );
  return (
    <OperationDialog onClose={onClose} pending={request.isPending}>
      <DialogHeader>
        <DialogTitle>Request factor recovery</DialogTitle>
        <DialogDescription>
          For {person.email}. A different super administrator must verify and
          approve. Approval removes all existing factors and sessions, and
          issues a temporary password.
        </DialogDescription>
      </DialogHeader>
      <form
        className="gap-4 grid"
        onSubmit={(event) => {
          event.preventDefault();
          request.mutate({ evidence, identityVerified: verified, reason });
        }}
      >
        <EvidenceText
          label="Reason and case reference"
          onChange={setReason}
          value={reason}
        />
        <EvidenceText
          label="Identity verification evidence"
          onChange={setEvidence}
          placeholder="Established callback channel, manager confirmation and case reference. No secrets or identity documents."
          value={evidence}
        />
        <VerifiedCheck checked={verified} onChange={setVerified}>
          I verified identity through established company channels.
        </VerifiedCheck>
        <OperationFooter
          disabled={!hasEvidence(reason) || !hasEvidence(evidence) || !verified}
          onCancel={onClose}
          pending={request.isPending}
          pendingLabel="Saving…"
          submitLabel="Request recovery"
        />
      </form>
    </OperationDialog>
  );
}

function OffboardDialog({
  onClose,
  person,
}: {
  onClose: () => void;
  person: Person;
}) {
  const [reason, setReason] = useState("");
  const offboard = usePersonOperation(
    person,
    "offboard",
    "Employee offboarded",
    onClose,
  );
  return (
    <OperationDialog onClose={onClose} pending={offboard.isPending}>
      <DialogHeader>
        <DialogTitle>Offboard employee</DialogTitle>
        <DialogDescription>
          Suspend {person.email}, revoke sessions and business grants, remove
          memberships and clear identity privileges. The account and audit
          history are retained.
        </DialogDescription>
      </DialogHeader>
      <form
        className="gap-4 grid"
        onSubmit={(event) => {
          event.preventDefault();
          offboard.mutate({ reason });
        }}
      >
        <EvidenceText
          label="Reason and case reference"
          onChange={setReason}
          value={reason}
        />
        <p className="text-xs text-muted-foreground">
          Confirm HR authorization before proceeding. Restoring the account
          later will require new memberships and business grants.
        </p>
        <OperationFooter
          disabled={!hasEvidence(reason)}
          onCancel={onClose}
          pending={offboard.isPending}
          pendingLabel="Saving…"
          submitLabel="Offboard employee"
          variant="destructive"
        />
      </form>
    </OperationDialog>
  );
}

export function FactorRecoveryQueue() {
  const { session } = shellRoute.useRouteContext();
  const requests = useQuery(factorRecoveryQueryOptions);
  const people = useQuery(everyPersonQueryOptions);
  const [selected, setSelected] = useState<FactorRecoveryRequest | null>(null);
  const superAdmin = isSuperAdmin(session?.user?.role);
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
      description={`Independent identity verification and super-administrator approval are required. Pending requests expire after ${ACCESS_WINDOWS.factorRecoveryMinutes} minutes.`}
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
      announce.failed(error);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  return (
    <OperationDialog onClose={onClose} pending={approve.isPending}>
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
              Verify identity independently of the requester. Approval replaces
              the password and removes all existing passkeys, authenticators,
              recovery codes, trusted-device records and sessions.
            </DialogDescription>
          </DialogHeader>
          <form
            className="gap-4 grid"
            onSubmit={(event) => {
              event.preventDefault();
              approve.mutate();
            }}
          >
            <EvidenceText
              label="Independent verification evidence"
              onChange={setEvidence}
              placeholder="Established callback channel and case reference. No secrets."
              value={evidence}
            />
            <VerifiedCheck checked={verified} onChange={setVerified}>
              I independently verified the account holder's identity.
            </VerifiedCheck>
            <OperationFooter
              disabled={!verified || !hasEvidence(evidence)}
              onCancel={onClose}
              pending={approve.isPending}
              pendingLabel="Approving…"
              submitLabel="Approve and replace factors"
            />
          </form>
        </>
      )}
    </OperationDialog>
  );
}
