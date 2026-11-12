import { NEWEST_FIRST } from "@repo/contracts/notifications";
import { AppTrail, Page } from "@repo/shell/app-shell";
import {
  DataTableColumnVisibility,
  DataTableFacet,
  DataTablePagination,
  DataTableSkeleton,
  DataTableSortHeader,
  DataTableToolbar,
  DataTableView,
  createDataTableColumnHelper,
  useDataTable,
} from "@repo/ui/blocks/data-table";
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
import { relativeTime } from "@repo/ui/lib/relative-time";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Failed, FIGURE, MONO, PANEL } from "../../../components/admin-surface";
import {
  ChannelName,
  channelLabel,
  exactTime,
  reasonLabel,
} from "../../../components/notification-status";
import { announce } from "../../../lib/api";
import {
  facetOptions,
  useCollectionSearch,
} from "../../../lib/collection-search";
import {
  liftSuppression,
  NOTIFICATIONS_QUERY_KEY,
  SUPPRESSION_FACETS,
  type Suppression,
  suppressionsQueryOptions,
  validateSuppressionSearch,
} from "../../../lib/notifications";

export const Route = createFileRoute("/_shell/notifications/suppressions")({
  validateSearch: validateSuppressionSearch,
  component: SuppressionsPage,
});

function SuppressionsPage() {
  return (
    <Page
      breadcrumb={
        <AppTrail
          items={[
            { label: "Notifications", to: "/notifications" },
            { label: "Suppressions" },
          ]}
        />
      }
      description="Destinations blocked after a bounce, complaint, or refusal."
      title="Suppressions"
    >
      <SuppressionList />
    </Page>
  );
}

const suppressionColumnHelper = createDataTableColumnHelper<Suppression>();
const EMPTY_SUPPRESSIONS: Suppression[] = [];

function SuppressionList() {
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const collection = useCollectionSearch({
    defaultSort: NEWEST_FIRST,
    search,
    to: Route.fullPath,
  });
  const { channel = [], reason = [] } = search;
  const { q, update } = collection;
  const [confirmation, setConfirmation] = useState<Suppression | null>(null);
  const suppressions = useQuery(suppressionsQueryOptions(search));

  const lift = useMutation({
    mutationFn: liftSuppression,
    onError: announce.failed,
    onSuccess: async () => {
      announce.done("The workspace may write there again");
      await queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_QUERY_KEY,
      });
    },
  });
  const liftPending = lift.isPending;

  const columns = useMemo(
    () =>
      suppressionColumnHelper.columns([
        suppressionColumnHelper.accessor("channel", {
          header: ({ column }) => (
            <DataTableSortHeader column={column}>Channel</DataTableSortHeader>
          ),
          cell: ({ getValue }) => <ChannelName channel={getValue()} />,
        }),
        suppressionColumnHelper.accessor("destination", {
          header: ({ column }) => (
            <DataTableSortHeader column={column}>
              Destination
            </DataTableSortHeader>
          ),
          cell: ({ getValue }) => <span className={MONO}>{getValue()}</span>,
        }),
        suppressionColumnHelper.accessor("reason", {
          header: ({ column }) => (
            <DataTableSortHeader column={column}>Reason</DataTableSortHeader>
          ),
        }),
        suppressionColumnHelper.accessor("createdAt", {
          header: ({ column }) => (
            <DataTableSortHeader column={column}>Since</DataTableSortHeader>
          ),
          cell: ({ getValue }) => (
            <span className={FIGURE} title={exactTime(getValue())}>
              {relativeTime(getValue())}
            </span>
          ),
        }),
        suppressionColumnHelper.display({
          id: "actions",
          header: "Action",
          cell: ({ row }) => (
            <Button
              data-row-action
              disabled={liftPending}
              onClick={() => setConfirmation(row.original)}
              size="sm"
              variant="ghost"
            >
              Allow again
            </Button>
          ),
        }),
      ]),
    [liftPending],
  );
  const table = useDataTable({
    columns,
    data: suppressions.data?.data ?? EMPTY_SUPPRESSIONS,
    pageCount: suppressions.data?.meta.totalPages ?? 1,
    ...collection.table,
  });
  const aggregations = suppressions.data?.meta.aggregations;

  return (
    <div className={PANEL}>
      <DataTableToolbar
        onSearchChange={collection.setSearchText}
        search={collection.searchText}
        searchLabel="Search suppressed destinations"
        searchPlaceholder="Destination"
      >
        <DataTableFacet
          label="Channel"
          onChange={(values) =>
            update({ channel: values.length ? values : undefined })
          }
          options={facetOptions(
            aggregations?.channel,
            SUPPRESSION_FACETS.channel,
            channelLabel,
          )}
          selected={channel}
        />
        <DataTableFacet
          label="Reason"
          onChange={(values) =>
            update({ reason: values.length ? values : undefined })
          }
          options={facetOptions(
            aggregations?.reason,
            SUPPRESSION_FACETS.reason,
            reasonLabel,
          )}
          selected={reason}
        />
        {channel.length || reason.length || q ? (
          <Button
            onClick={() =>
              update({ channel: undefined, q: undefined, reason: undefined })
            }
            size="sm"
            variant="ghost"
          >
            Clear
          </Button>
        ) : null}
        <DataTableColumnVisibility
          labels={{
            channel: "Channel",
            createdAt: "Since",
            destination: "Destination",
            reason: "Reason",
          }}
          table={table}
        />
      </DataTableToolbar>
      {suppressions.isPending ? (
        <DataTableSkeleton columns={5} />
      ) : suppressions.isError ? (
        <Failed
          error={suppressions.error}
          onRetry={() => void suppressions.refetch()}
          what="suppression list"
        />
      ) : (
        <DataTableView
          caption="Suppressed notification destinations"
          columnClassName={(id) =>
            id === "actions"
              ? "w-28 text-right"
              : id === "channel" || id === "createdAt"
                ? "w-28 text-muted-foreground"
                : ""
          }
          empty={
            q || channel.length || reason.length
              ? "No suppressed destination fits those filters."
              : "Nobody is suppressed."
          }
          mobileRow={(suppression) => (
            <div className="gap-3 p-4 flex items-start justify-between">
              <div className="min-w-0">
                <p className={`${MONO} text-sm truncate`}>
                  {suppression.destination}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <ChannelName
                    channel={suppression.channel}
                    className="inline-flex"
                  />{" "}
                  · {suppression.reason}
                </p>
                <p
                  className={`${FIGURE} mt-1 text-xs text-muted-foreground`}
                  title={exactTime(suppression.createdAt)}
                >
                  {relativeTime(suppression.createdAt)}
                </p>
              </div>
              <Button
                data-row-action
                disabled={lift.isPending}
                onClick={() => setConfirmation(suppression)}
                size="sm"
                variant="ghost"
              >
                Allow again
              </Button>
            </div>
          )}
          table={table}
        />
      )}
      <DataTablePagination
        countLabel={`${suppressions.data?.meta.total ?? 0} suppressed`}
        table={table}
      />

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        open={confirmation !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lift this suppression?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {confirmation
                ? `${confirmation.destination} can receive ${channelLabel(confirmation.channel).toLowerCase()} messages again. Only continue if the underlying ${confirmation.reason} issue is resolved.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={lift.isPending}
              onClick={() => {
                if (!confirmation) return;
                lift.mutate(confirmation.id, {
                  onSuccess: () => setConfirmation(null),
                });
              }}
              size="sm"
            >
              Lift suppression
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
