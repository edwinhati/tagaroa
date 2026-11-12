import { EVIDENCE_LENGTH } from "@repo/contracts/identity";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { AdminApiError, announce } from "../lib/api";
import {
  accessReviewQueueQueryOptions,
  recordBusinessAccessReview,
  type ReviewSubject,
} from "../lib/business-access";
import { directoryQueryOptions, type Directory } from "../lib/directory";
import { everyPersonQueryOptions, type Person } from "../lib/people";
import {
  Failed,
  Mark,
  Nothing,
  PanelSkeleton,
  SurfaceSection,
} from "./admin-surface";

export function AccessReviewQueue({
  reviewerId,
  canReview,
}: {
  reviewerId: string | undefined;
  canReview: boolean;
}) {
  const queue = useQuery(accessReviewQueueQueryOptions);
  const people = useQuery(everyPersonQueryOptions);
  const directory = useQuery(directoryQueryOptions);
  const [selected, setSelected] = useState<ReviewSubject | null>(null);
  if (queue.isPending || people.isPending || directory.isPending)
    return <PanelSkeleton rows={3} />;
  const error = queue.error || people.error || directory.error;
  if (error)
    return (
      <Failed
        what="business access reviews"
        error={error}
        onRetry={() => {
          void queue.refetch();
          void people.refetch();
          void directory.refetch();
        }}
      />
    );
  return (
    <>
      {(["assignment", "emergency"] as const).map((kind) => (
        <ReviewSection
          key={kind}
          kind={kind}
          subjects={(queue.data ?? []).filter((row) => row.kind === kind)}
        >
          {(subject) => (
            <ReviewSubjectRow
              key={subject.id}
              canReview={canReview}
              directory={directory.data}
              onReview={() => setSelected(subject)}
              person={people.data?.find((row) => row.id === subject.userId)}
              reviewerId={reviewerId}
              subject={subject}
            />
          )}
        </ReviewSection>
      ))}
      {selected ? (
        <ReviewDialog subject={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}

type ReviewKind = ReviewSubject["kind"];

function ReviewSection({
  kind,
  subjects,
  children,
}: {
  kind: ReviewKind;
  subjects: ReviewSubject[];
  children: (subject: ReviewSubject) => ReactNode;
}) {
  const pending = subjects.filter((row) => row.eligible && !row.review).length;
  return (
    <SurfaceSection
      framed={false}
      title={
        kind === "assignment" ? "Business assignments" : "Emergency access"
      }
      description={
        kind === "assignment"
          ? `${pending} pending this week. Check the responsibility, scope and duration.`
          : `${pending} completed activations need review. Check the reason and activity trail.`
      }
    >
      {subjects.length === 0 ? (
        <Nothing
          framed={false}
          title={
            kind === "assignment"
              ? "No business assignments"
              : "No emergency access"
          }
        />
      ) : (
        <ul className="px-3 py-1">{subjects.map(children)}</ul>
      )}
    </SurfaceSection>
  );
}

function ReviewSubjectRow({
  canReview,
  directory,
  onReview,
  person,
  reviewerId,
  subject,
}: {
  canReview: boolean;
  directory: Directory | undefined;
  onReview: () => void;
  person: Person | undefined;
  reviewerId: string | undefined;
  subject: ReviewSubject;
}) {
  const subsidiary = directory?.subsidiaries.find(
    (row) => row.id === subject.organizationId,
  );
  const team = directory?.teams.find((row) => row.id === subject.teamId);
  const independent =
    reviewerId !== subject.userId && reviewerId !== subject.grantedBy;
  return (
    <li className="row-hover gap-3 flex flex-wrap items-center">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[13px]">
          {person?.email ?? subject.userId} · {subject.label}
        </p>
        <p className="text-xs text-muted-foreground">
          {subsidiary?.name ?? subject.organizationId} /{" "}
          {team?.name ?? "All teams"} · {subject.detail}
        </p>
        {subject.review ? (
          <p className="text-xs text-muted-foreground">{subject.review.note}</p>
        ) : null}
      </div>
      {subject.review ? (
        <Mark
          label={
            subject.review.decision === "confirmed"
              ? "Confirmed"
              : "Flagged for action"
          }
          tone={subject.review.decision === "confirmed" ? "done" : "warn"}
        />
      ) : null}
      {!subject.eligible ? (
        <Mark
          label={subject.kind === "emergency" ? "In progress" : "Inactive"}
          tone="away"
        />
      ) : !independent ? (
        <Mark label="Needs another reviewer" tone="away" />
      ) : canReview ? (
        <Button size="sm" variant="outline" onClick={onReview}>
          {subject.review ? "Review again" : "Review access"}
        </Button>
      ) : (
        <Mark label="Pending review" tone="away" />
      )}
    </li>
  );
}

function ReviewDialog({
  subject,
  onClose,
}: {
  subject: ReviewSubject;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [decision, setDecision] = useState<"confirmed" | "flagged">(
    "confirmed",
  );
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => recordBusinessAccessReview({ subject, decision, note }),
    onError: (error) => {
      void client.invalidateQueries({
        queryKey: accessReviewQueueQueryOptions.queryKey,
      });
      if (error instanceof AdminApiError && error.status === 409) onClose();
      announce.failed(error);
    },
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: accessReviewQueueQueryOptions.queryKey,
      });
      announce.done("Access review recorded");
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
          <DialogTitle>Review access</DialogTitle>
          <DialogDescription>
            {subject.label}. Record the approval evidence or concern. Flagging
            does not revoke access; an administrator must act on it.
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
            Decision
            <Select
              items={[
                { label: "Confirm access", value: "confirmed" },
                { label: "Flag for action", value: "flagged" },
              ]}
              value={decision}
              onValueChange={(value) => {
                if (value === "confirmed" || value === "flagged")
                  setDecision(value);
              }}
            >
              <SelectTrigger aria-label="Review decision">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">Confirm access</SelectItem>
                <SelectItem value="flagged">Flag for action</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="gap-1.5 text-xs grid">
            Review evidence
            <Textarea
              required
              minLength={EVIDENCE_LENGTH.min}
              maxLength={EVIDENCE_LENGTH.max}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Manager confirmation, case reference, or the concern to investigate"
            />
          </label>
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
              disabled={
                save.isPending || note.trim().length < EVIDENCE_LENGTH.min
              }
            >
              {save.isPending ? "Recording…" : "Record review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
