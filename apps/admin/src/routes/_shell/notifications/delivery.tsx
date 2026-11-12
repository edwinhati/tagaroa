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
import { Button } from "@repo/ui/components/button";
import { relativeTime } from "@repo/ui/lib/relative-time";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PanelRightOpenIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Failed, FIGURE, MONO, PANEL } from "../../../components/admin-surface";
import { MessageDetail } from "../../../components/message-detail";
import {
  ChannelName,
  channelLabel,
  exactTime,
  Status,
  statusLabel,
} from "../../../components/notification-status";
import {
  facetOptions,
  useCollectionSearch,
} from "../../../lib/collection-search";
import {
  DELIVERY_FACETS,
  type Message,
  messagesQueryOptions,
  validateDeliverySearch,
} from "../../../lib/notifications";

export const Route = createFileRoute("/_shell/notifications/delivery")({
  validateSearch: validateDeliverySearch,
  component: DeliveryLogPage,
});

function DeliveryLogPage() {
  return (
    <Page
      breadcrumb={
        <AppTrail
          items={[
            { label: "Notifications", to: "/notifications" },
            { label: "Delivery log" },
          ]}
        />
      }
      description="What was sent, where it went, and how delivery ended."
      title="Delivery log"
    >
      <DeliveryLog />
    </Page>
  );
}

const activityColumnHelper = createDataTableColumnHelper<Message>();
const EMPTY_MESSAGES: Message[] = [];

function DeliveryLog() {
  const search = Route.useSearch();
  const collection = useCollectionSearch({
    defaultSort: NEWEST_FIRST,
    search,
    to: Route.fullPath,
  });
  const { channel = [], status = [] } = search;
  const { q, update } = collection;
  const [reading, setReading] = useState<Message | null>(null);
  const messages = useQuery(messagesQueryOptions(search));
  const columns = useMemo(
    () =>
      activityColumnHelper.columns([
        activityColumnHelper.accessor("createdAt", {
          header: ({ column }) => (
            <DataTableSortHeader column={column}>When</DataTableSortHeader>
          ),
          cell: ({ getValue }) => (
            <span className={FIGURE} title={exactTime(getValue())}>
              {relativeTime(getValue())}
            </span>
          ),
        }),
        activityColumnHelper.accessor("key", {
          header: ({ column }) => (
            <DataTableSortHeader column={column}>Message</DataTableSortHeader>
          ),
          cell: ({ getValue }) => <span className={MONO}>{getValue()}</span>,
        }),
        activityColumnHelper.accessor("channel", {
          header: ({ column }) => (
            <DataTableSortHeader column={column}>Channel</DataTableSortHeader>
          ),
          cell: ({ getValue }) => <ChannelName channel={getValue()} />,
        }),
        activityColumnHelper.accessor("destination", {
          header: ({ column }) => (
            <DataTableSortHeader column={column}>To</DataTableSortHeader>
          ),
          cell: ({ getValue }) => (
            <span
              className={`${MONO} max-w-64 block truncate`}
              title={getValue()}
            >
              {getValue()}
            </span>
          ),
        }),
        activityColumnHelper.accessor("status", {
          header: ({ column }) => (
            <DataTableSortHeader column={column}>Status</DataTableSortHeader>
          ),
          cell: ({ getValue }) => <Status status={getValue()} />,
        }),
        activityColumnHelper.accessor("attempts", {
          header: "Tries",
          cell: ({ getValue }) => <span className={FIGURE}>{getValue()}</span>,
        }),
        activityColumnHelper.display({
          id: "actions",
          cell: ({ row }) => (
            <Button
              aria-label={`View ${row.original.key} to ${row.original.destination}`}
              data-row-action
              onClick={() => setReading(row.original)}
              size="icon-sm"
              variant="ghost"
            >
              <PanelRightOpenIcon aria-hidden="true" strokeWidth={1.5} />
            </Button>
          ),
        }),
      ]),
    [],
  );
  const table = useDataTable({
    columns,
    data: messages.data?.data ?? EMPTY_MESSAGES,
    pageCount: messages.data?.meta.totalPages ?? 1,
    ...collection.table,
  });
  const aggregations = messages.data?.meta.aggregations;

  return (
    <div className={PANEL}>
      <DataTableToolbar
        onSearchChange={collection.setSearchText}
        search={collection.searchText}
        searchLabel="Search the message log"
        searchPlaceholder="Address or message name"
      >
        <DataTableFacet
          label="Channel"
          onChange={(values) =>
            update({ channel: values.length ? values : undefined })
          }
          options={facetOptions(
            aggregations?.channel,
            DELIVERY_FACETS.channel,
            channelLabel,
          )}
          selected={channel}
        />
        <DataTableFacet
          label="Status"
          onChange={(values) =>
            update({ status: values.length ? values : undefined })
          }
          options={facetOptions(
            aggregations?.status,
            DELIVERY_FACETS.status,
            statusLabel,
          )}
          selected={status}
        />
        {channel.length || status.length || q ? (
          <Button
            onClick={() =>
              update({ channel: undefined, q: undefined, status: undefined })
            }
            size="sm"
            variant="ghost"
          >
            Clear
          </Button>
        ) : null}
        <DataTableColumnVisibility
          labels={{
            attempts: "Tries",
            channel: "Channel",
            createdAt: "When",
            destination: "To",
            key: "Message",
            status: "Status",
          }}
          table={table}
        />
      </DataTableToolbar>
      {messages.isPending ? (
        <DataTableSkeleton columns={7} />
      ) : messages.isError ? (
        <Failed
          error={messages.error}
          onRetry={() => void messages.refetch()}
          what="delivery log"
        />
      ) : (
        <DataTableView
          caption="Notification activity"
          columnClassName={(id) =>
            id === "actions"
              ? "w-10 text-right"
              : id === "attempts"
                ? "w-16 text-right"
                : ""
          }
          empty={
            q || channel.length || status.length
              ? "No message fits those filters."
              : "No message has been sent yet."
          }
          mobileRow={(message) => (
            <button
              className="p-4 block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
              onClick={() => setReading(message)}
              type="button"
            >
              <span className="gap-3 flex items-center justify-between">
                <span className={`${MONO} text-sm truncate`}>
                  {message.key}
                </span>
                <Status status={message.status} />
              </span>
              <span
                className={`${MONO} mt-2 text-xs block truncate text-muted-foreground`}
              >
                {message.destination}
              </span>
              <span className="mt-1 gap-2 text-xs flex text-muted-foreground">
                <ChannelName channel={message.channel} />
                <span aria-hidden="true">·</span>
                <span title={exactTime(message.createdAt)}>
                  {relativeTime(message.createdAt)}
                </span>
              </span>
            </button>
          )}
          onRowClick={setReading}
          table={table}
        />
      )}
      <DataTablePagination
        countLabel={`${messages.data?.meta.total ?? 0} messages · refreshed every 15 seconds`}
        table={table}
      />

      <MessageDetail message={reading} onClose={() => setReading(null)} />
    </div>
  );
}
