import { mayRun, primaryRoleLabel } from "@repo/contracts/identity";
import { AppTrail, Page } from "@repo/shell/app-shell";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import { Progress, ProgressLabel } from "@repo/ui/components/progress";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AccessReviewQueue } from "../../../components/access-review-queue";
import {
  COLLECTION,
  Failed,
  Mark,
  FIGURE,
  MONO,
  Nothing,
  PanelSkeleton,
  SurfaceSection,
} from "../../../components/admin-surface";
import { FactorRecoveryQueue } from "../../../components/identity-security-operations";
import type { IdentityIssue, VisibleAttentionKind } from "../../../lib/admin";
import {
  announce,
  dashboardQueryOptions,
  reviewPrivilegedAccess,
} from "../../../lib/admin";

const isOrganizationGap = (
  issue: IdentityIssue,
): issue is IdentityIssue & { kind: "no-subsidiary" } =>
  issue.kind === "no-subsidiary";

export const Route = createFileRoute("/_shell/identity-access/reviews")({
  component: Reviews,
});

const shellRoute = getRouteApi("/_shell");

function Reviews() {
  const { session } = shellRoute.useRouteContext();
  const canReview = mayRun(session?.user?.role, "review");
  const dashboard = useQuery(dashboardQueryOptions);
  const queryClient = useQueryClient();
  const confirm = useMutation({
    mutationFn: reviewPrivilegedAccess,
    onError: announce.failed,
    onSuccess: async () => {
      announce.done("Privileged access confirmed");
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryOptions.queryKey,
      });
    },
  });

  return (
    <Page
      breadcrumb={
        <AppTrail
          items={[
            { label: "Identity & access", to: "/identity-access" },
            { label: "Reviews" },
          ]}
        />
      }
      title="Reviews"
    >
      {dashboard.isPending ? (
        <div className={COLLECTION}>
          <Skeleton className="h-10 max-w-sm" />
          <PanelSkeleton rows={5} />
        </div>
      ) : dashboard.isError ? (
        <Failed
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
          what="reviews"
        />
      ) : (
        <div className={COLLECTION}>
          <SurfaceSection framed={false} title="This week">
            <div className="max-w-md">
              <Progress
                className="w-full"
                value={
                  dashboard.data.accessReview.total === 0
                    ? 100
                    : (dashboard.data.accessReview.reviewed /
                        dashboard.data.accessReview.total) *
                      100
                }
              >
                <ProgressLabel className="text-[12.5px]">
                  Reviewed
                </ProgressLabel>
                <span className={`${FIGURE} ml-auto text-muted-foreground`}>
                  {dashboard.data.accessReview.reviewed} of{" "}
                  {dashboard.data.accessReview.total}
                </span>
              </Progress>
            </div>
          </SurfaceSection>

          <ReviewSection
            count={
              dashboard.data.accessReview.people.filter(
                (person) => !person.reviewed,
              ).length
            }
            title="Privileged access"
          >
            {dashboard.data.accessReview.people.length === 0 ? (
              <Nothing framed={false} title="No privileged accounts">
                Confirm access once operators hold identity roles.
              </Nothing>
            ) : (
              <ul className="px-3 py-1">
                {dashboard.data.accessReview.people.map((person) => (
                  <li
                    className="row-hover gap-3 sm:grid-cols-[minmax(12rem,1fr)_9rem_auto] sm:items-center grid"
                    key={person.userId}
                  >
                    <PersonIdentity email={person.email} name={person.name} />
                    <span className="text-[13px] text-muted-foreground">
                      {primaryRoleLabel(person.role)}
                    </span>
                    {person.reviewed ? (
                      <Mark label="Confirmed" tone="done" />
                    ) : person.userId === session?.user?.id ? (
                      <Mark label="Needs another reviewer" tone="away" />
                    ) : canReview ? (
                      <Button
                        disabled={confirm.isPending}
                        onClick={() => confirm.mutate(person.userId)}
                        size="sm"
                        variant="outline"
                      >
                        Confirm access
                      </Button>
                    ) : (
                      <Mark label="Pending review" tone="away" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ReviewSection>

          <AccessReviewQueue
            reviewerId={session?.user?.id}
            canReview={canReview}
          />

          <FactorRecoveryQueue />

          <ReviewIssues
            framed={false}
            issues={dashboard.data.attention.filter(isOrganizationGap)}
            title="Organization gaps"
          />
        </div>
      )}
    </Page>
  );
}

function ReviewSection({
  children,
  count,
  description,
  framed = true,
  title,
}: {
  children: ReactNode;
  count: number;
  description?: string;
  framed?: boolean;
  title: string;
}) {
  return (
    <SurfaceSection
      description={description}
      framed={framed}
      title={title}
      trailing={
        <span className={`${FIGURE} text-muted-foreground`}>{count}</span>
      }
    >
      {children}
    </SurfaceSection>
  );
}

function ReviewIssues({
  framed = true,
  issues,
  title,
}: {
  framed?: boolean;
  issues: Array<IdentityIssue & { kind: VisibleAttentionKind }>;
  title: string;
}) {
  if (!issues[0]) return null;

  return (
    <ReviewSection count={issues.length} framed={framed} title={title}>
      <ul className={framed ? "px-3 py-1" : "flex flex-col"}>
        {issues.slice(0, 8).map((issue) => (
          <li
            className="row-hover gap-3 sm:grid-cols-[minmax(12rem,1fr)_8rem_auto] sm:items-center grid"
            key={`${issue.kind}:${issue.userId}`}
          >
            <PersonIdentity email={issue.email} name={issue.name} />
            <span className={`${FIGURE} text-muted-foreground`}>
              {issue.ageDays === 0 ? "Today" : `${issue.ageDays}d old`}
            </span>
            <Button
              nativeButton={false}
              render={
                <Link
                  search={{ q: issue.email }}
                  to="/identity-access/people"
                />
              }
              size="sm"
              variant="outline"
            >
              Review person
            </Button>
          </li>
        ))}
      </ul>
    </ReviewSection>
  );
}

function PersonIdentity({ email, name }: { email: string; name: string }) {
  const initial = (name || email).trim().charAt(0).toUpperCase();
  return (
    <div className="min-w-0 gap-2.5 flex items-center">
      <Avatar size="sm">
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="font-medium truncate text-[13px]">{name || email}</p>
        <p className={`${MONO} mt-0.5 truncate text-muted-foreground`}>
          {email}
        </p>
      </div>
    </div>
  );
}
