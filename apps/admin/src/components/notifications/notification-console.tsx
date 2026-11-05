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
  useDebouncedValue,
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
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@repo/ui/components/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  functionalUpdate,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { EllipsisIcon, PanelRightOpenIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { announce } from "../../lib/admin";
import {
  type ChannelHealth,
  type Message,
  type Overview,
  type Suppression,
  type Template,
  deleteTemplate,
  liftSuppression,
  messagesQueryOptions,
  overviewQueryOptions,
  publishTemplate,
  suppressionsQueryOptions,
  templatesQueryOptions,
} from "../../lib/notifications";
import {
  COLLECTION,
  COLUMN,
  Failed,
  FIGURE,
  Mark,
  MONO,
  Nothing,
  PANEL,
  SECTION,
  SurfaceBanner,
} from "../admin-surface";
import { MessageDetail } from "../message-detail";
import {
  ChannelName,
  channelLabel,
  exactTime,
  relativeTime,
  Status,
  statusLabel,
  TemplateStatus,
} from "../notification-status";
import { TemplateDetail } from "../template-detail";
import { WordingEditor } from "../wording-editor";

/**
 * Every field is optional, and a default is never written into the URL: a link
 * to the page carries no query at all, and `?status=failed` says exactly one
 * thing rather than four, three of which are "no filter".
 */
export interface DeliverySearch {
  status?: string[];
  channel?: string[];
  q?: string;
  sort?: string;
  page?: number;
  size?: number;
}

export interface SuppressionSearch {
  reason?: string[];
  channel?: string[];
  q?: string;
  sort?: string;
  page?: number;
  size?: number;
}

const text = (value: unknown, fallback = "") =>
  typeof value === "string" && value.length > 0 ? value : fallback;

const list = (value: unknown): string[] =>
  (Array.isArray(value) ? value : typeof value === "string" ? [value] : [])
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

const positiveInteger = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

const collectionSearch = (search: Record<string, unknown>) => {
  const channel = list(search.channel).filter((value) =>
    ["email", "sms", "whatsapp"].includes(value),
  );
  const q = text(search.q).slice(0, 200);
  const sort = text(search.sort).slice(0, 200);
  const page = positiveInteger(search.page);
  const sizeValue = positiveInteger(search.size);
  const size =
    sizeValue && [10, 25, 50, 100].includes(sizeValue) ? sizeValue : undefined;

  return {
    ...(channel.length ? { channel } : {}),
    ...(q ? { q } : {}),
    ...(sort ? { sort } : {}),
    ...(page && page !== 1 ? { page } : {}),
    ...(size && size !== 25 ? { size } : {}),
  };
};

export function validateDeliverySearch(
  search: Record<string, unknown>,
): DeliverySearch {
  const status = list(search.status).map((value) => value.slice(0, 80));
  return {
    ...collectionSearch(search),
    ...(status.length ? { status } : {}),
  };
}

export function validateSuppressionSearch(
  search: Record<string, unknown>,
): SuppressionSearch {
  const reason = list(search.reason).map((value) => value.slice(0, 80));
  return {
    ...collectionSearch(search),
    ...(reason.length ? { reason } : {}),
  };
}

export function NotificationOverviewPage() {
  const overview = useQuery(overviewQueryOptions);

  return (
    <Page
      breadcrumb={<AppTrail items={[{ label: "Notifications" }]} />}
      description={overview.data ? overviewSummary(overview.data) : undefined}
      title="Notifications"
    >
      <div className={COLLECTION}>
        {overview.data && !overview.data.live ? <ConsoleMode /> : null}
        {overview.isError ? (
          <Failed
            error={overview.error}
            onRetry={() => void overview.refetch()}
            what="delivery overview"
          />
        ) : overview.isPending ? (
          <>
            <Skeleton className="h-40 w-full rounded-[var(--panel-radius)]" />
            <Skeleton className="h-20 w-full rounded-[var(--panel-radius)]" />
          </>
        ) : (
          <>
            <Channels channels={overview.data.channels} />
            <div className={PANEL}>
              <Volume series={overview.data.series} />
            </div>
          </>
        )}
      </div>
    </Page>
  );
}

/**
 * The page's one sentence: whether anything went out, and whether every
 * channel can send. A row of zeros says neither.
 */
function overviewSummary({ channels, series, totals }: Overview) {
  const fortnight = series.reduce((sum, day) => sum + day.sent + day.failed, 0);
  const unready = channels.filter((channel) => !channel.configured).length;
  const traffic =
    totals.sent > 0
      ? `${totals.sent.toLocaleString()} sent in the last 24 hours, ${Math.round((totals.delivered / totals.sent) * 100)}% delivered${totals.failed > 0 ? `, ${totals.failed.toLocaleString()} failed` : ""}.`
      : fortnight > 0
        ? `Nothing sent in the last 24 hours; ${fortnight.toLocaleString()} in the last 14 days.`
        : "Nothing has been sent in the last 14 days.";
  const readiness =
    unready === 0
      ? ""
      : unready === channels.length
        ? " No channel has provider credentials yet."
        : ` ${unready} of ${channels.length} channels can't send until they have provider credentials.`;
  return `${traffic}${readiness}`;
}

export function DeliveryLogPage({
  onSearchChange,
  search,
}: {
  onSearchChange: (change: Partial<DeliverySearch>) => void;
  search: DeliverySearch;
}) {
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
      <DeliveryLogContent
        key={search.q ?? ""}
        onSearchChange={onSearchChange}
        search={search}
      />
    </Page>
  );
}

export function TemplatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });

  return (
    <Page
      actions={
        <Button onClick={() => setEditing("new")} size="sm">
          Create template
        </Button>
      }
      breadcrumb={
        <AppTrail
          items={[
            { label: "Notifications", to: "/notifications" },
            { label: "Templates" },
          ]}
        />
      }
      description="Write, review, and publish messages people receive."
      title="Templates"
    >
      <TemplateList onChanged={refresh} onEdit={setEditing} />
      <WordingEditor
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </Page>
  );
}

export function SuppressionsPage({
  onSearchChange,
  search,
}: {
  onSearchChange: (change: Partial<SuppressionSearch>) => void;
  search: SuppressionSearch;
}) {
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
      <SuppressionList
        key={search.q ?? ""}
        onSearchChange={onSearchChange}
        search={search}
      />
    </Page>
  );
}

/**
 * Said out loud, because the alternative is an admin watching a log fill with
 * "sent" and believing anything left the building.
 */
function ConsoleMode() {
  return (
    <SurfaceBanner tone="info">
      <p>
        <span className="font-medium text-foreground">Console mode.</span> No
        provider credentials are configured, so messages are written to the
        service log and do not leave this machine.
      </p>
    </SurfaceBanner>
  );
}

const volumeConfig = {
  sent: {
    label: "Sent",
    // Success, not info: in dark, --status-info-text equals --sea and would
    // make the bars read as interactive.
    color: "var(--status-success-text)",
  },
  failed: {
    label: "Failed",
    color: "var(--status-danger-text)",
  },
} satisfies ChartConfig;

/**
 * Fourteen days of sent and failed volume, composed as the stacked bar card
 * from the design system: title and range in the header, grid and x-axis in
 * the plot, legend under the ticks, totals in the footer.
 */
function Volume({ series }: { series: Overview["series"] }) {
  const firstDay = series[0];
  if (!firstDay) {
    return (
      <div className="gap-1 px-4 py-4 flex flex-col">
        <p className="font-medium text-[13px]">Volume</p>
        <p className="text-[12.5px] text-muted-foreground">Last 14 days</p>
        <p className="mt-2 text-sm text-muted-foreground">
          No delivery volume has been recorded yet.
        </p>
      </div>
    );
  }

  const total = series.reduce((sum, day) => sum + day.sent + day.failed, 0);
  if (total === 0) {
    return (
      <div className="gap-1 px-4 py-3.5 flex flex-col">
        <p className="font-medium text-[13px]">Volume, last 14 days</p>
        <p className="text-[12.5px] text-muted-foreground">
          The chart appears once a message is sent, with failures beside sends
          day by day.
        </p>
      </div>
    );
  }

  const lastIndex = series.length - 1;
  const peakDay = series.reduce((highest, day) =>
    day.sent + day.failed > highest.sent + highest.failed ? day : highest,
  );
  const peak = peakDay.sent + peakDay.failed;
  const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
  const label = (day: string) =>
    asDate(day).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  const tick = (day: string, index: number) => {
    if (index === lastIndex) return "Today";
    const date = asDate(day);
    const previous = series[index - 1];
    const named =
      !previous || asDate(previous.day).getUTCMonth() !== date.getUTCMonth();
    return date.toLocaleDateString(undefined, {
      day: "numeric",
      ...(named ? { month: "short" } : {}),
    });
  };
  const data = series.map((day) => ({
    day: day.day,
    failed: day.failed,
    sent: day.sent,
  }));

  return (
    <div className="notify-volume">
      <div>
        <p className="notify-volume-title">Volume</p>
        <p className="notify-volume-range">{label(firstDay.day)} – today</p>
      </div>
      <ChartContainer
        className="aspect-auto h-[250px] w-full"
        config={volumeConfig}
        initialDimension={{ height: 250, width: 640 }}
      >
        <BarChart accessibilityLayer barCategoryGap="24%" data={data}>
          <CartesianGrid vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="day"
            tickFormatter={tick}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            axisLine={false}
            domain={[0, Math.max(peak, 4)]}
            tick={false}
            tickCount={5}
            tickLine={false}
            width={0}
          />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="sent"
            fill="var(--color-sent)"
            isAnimationActive={false}
            stackId="a"
          />
          <Bar
            dataKey="failed"
            fill="var(--color-failed)"
            isAnimationActive={false}
            stackId="a"
          />
        </BarChart>
      </ChartContainer>
      <div className="notify-volume-foot">
        <div className="notify-volume-sum">
          {total.toLocaleString()} message{total === 1 ? "" : "s"} in 14 days
        </div>
        <div className="notify-volume-note">
          {peak > 0
            ? `Peak ${peak.toLocaleString()} on ${label(peakDay.day)}`
            : "No messages in this window"}
        </div>
      </div>
    </div>
  );
}

/**
 * The channels fail independently. An expired WhatsApp token is invisible in a
 * total that email dominates, so each one states its own case, including the
 * case of not being configured at all.
 */
function Channels({ channels }: { channels: ChannelHealth[] }) {
  if (channels.length === 0) return null;

  return (
    <section aria-labelledby="channels-title" className={PANEL}>
      <div className="gap-3 px-4 py-3.5 flex items-baseline justify-between">
        <h2 className={SECTION} id="channels-title">
          Channels
        </h2>
        <span className={`${FIGURE} text-muted-foreground`}>Last 24 hours</span>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[40rem] text-[13px]">
          <thead>
            <tr className="h-8 border-t border-border text-left">
              <th className={`${COLUMN} px-4`} scope="col">
                Channel
              </th>
              <th className={`${COLUMN} px-4`} scope="col">
                State
              </th>
              {(["Queued", "Sent", "Failed", "Suppressed"] as const).map(
                (label) => (
                  <th
                    className={`${COLUMN} px-4 text-right`}
                    key={label}
                    scope="col"
                  >
                    {label}
                  </th>
                ),
              )}
              <th className="px-4" scope="col">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {channels.map((channel) => {
              const attempted = channel.sent + channel.failed;
              const failureRate =
                attempted > 0
                  ? Math.round((channel.failed / attempted) * 100)
                  : 0;
              return (
                <tr
                  className="row-hover-bg h-12 border-t border-border"
                  key={channel.channel}
                >
                  <td className="px-4">
                    <ChannelName
                      channel={channel.channel}
                      className="font-medium text-[13px]"
                    />
                    <span className="ml-2 text-muted-foreground">
                      {channel.provider}
                    </span>
                  </td>
                  <td className="px-4">
                    <Mark
                      className="text-[12.5px]"
                      label={channel.configured ? "Ready" : "Needs credentials"}
                      tone={channel.configured ? "done" : "warn"}
                    />
                  </td>
                  <td className="px-4 text-right tabular-nums">
                    {channel.queued.toLocaleString()}
                  </td>
                  <td className="px-4 text-right tabular-nums">
                    {channel.sent.toLocaleString()}
                  </td>
                  <td
                    className={cn(
                      "px-4 text-right tabular-nums",
                      channel.failed > 0 && "text-status-danger-text",
                    )}
                  >
                    {channel.failed.toLocaleString()}
                    {failureRate > 0 ? ` (${failureRate}%)` : ""}
                  </td>
                  <td className="px-4 text-right tabular-nums">
                    {channel.suppressed.toLocaleString()}
                  </td>
                  <td className="px-4 text-right">
                    <Button
                      nativeButton={false}
                      render={
                        <Link
                          search={{ channel: [channel.channel] }}
                          to="/notifications/delivery"
                        />
                      }
                      size="sm"
                      variant="ghost"
                    >
                      Delivery log
                      <span className="sr-only">
                        {" "}
                        for {channelLabel(channel.channel)}
                      </span>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const STATUSES = [
  "pending",
  "sending",
  "sent",
  "delivered",
  "failed",
  "bounced",
  "suppressed",
];

const activityColumnHelper = createDataTableColumnHelper<Message>();
const EMPTY_MESSAGES: Message[] = [];

function DeliveryLogContent({
  onSearchChange,
  search,
}: {
  onSearchChange: (change: Partial<DeliverySearch>) => void;
  search: DeliverySearch;
}) {
  const {
    channel = [],
    page = 1,
    q = "",
    size = 25,
    sort = "-createdAt",
    status = [],
  } = search;
  const [reading, setReading] = useState<Message | null>(null);
  const [query, setQuery] = useState(q);
  const pagination: PaginationState = { pageIndex: page - 1, pageSize: size };
  const debouncedQuery = useDebouncedValue(query);
  const messages = useQuery(
    messagesQueryOptions({
      channel,
      limit: pagination.pageSize,
      page: pagination.pageIndex + 1,
      search: q,
      sort,
      status,
    }),
  );

  const narrow = (change: Partial<DeliverySearch>) =>
    onSearchChange({ ...change, page: undefined });

  useEffect(() => {
    if (debouncedQuery.trim() === q) return;
    onSearchChange({
      page: undefined,
      q: debouncedQuery.trim() || undefined,
    });
  }, [debouncedQuery, onSearchChange, q]);

  const sorting = useMemo<SortingState>(
    () =>
      sort
        .split(",")
        .filter(Boolean)
        .map((entry) => ({
          desc: entry.startsWith("-"),
          id: entry.replace(/^-/, ""),
        })),
    [sort],
  );
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
    manualPagination: true,
    manualSorting: true,
    onPaginationChange: (updater) => {
      const next = functionalUpdate(updater, pagination);
      onSearchChange({
        page: next.pageIndex > 0 ? next.pageIndex + 1 : undefined,
        size: next.pageSize === 25 ? undefined : next.pageSize,
      });
    },
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting);
      narrow({
        sort:
          next
            .map((entry) => `${entry.desc ? "-" : ""}${entry.id}`)
            .join(",") || undefined,
      });
    },
    pageCount: messages.data?.meta.totalPages ?? 1,
    state: { pagination, sorting },
  });
  const aggregation = messages.data?.meta.aggregations;
  const facetOptions = (name: "channel" | "status", values: string[]) => {
    const counts = new Map(
      (aggregation?.[name] ?? []).map((bucket) => [bucket.value, bucket.count]),
    );
    return values.map((value) => ({
      count: counts.get(value) ?? 0,
      label: name === "channel" ? channelLabel(value) : statusLabel(value),
      value,
    }));
  };

  return (
    <div className={PANEL}>
      <DataTableToolbar
        onSearchChange={(value) => {
          setQuery(value);
        }}
        search={query}
        searchLabel="Search the message log"
        searchPlaceholder="Address or message name"
      >
        <DataTableFacet
          label="Channel"
          onChange={(values) =>
            narrow({ channel: values.length ? values : undefined })
          }
          options={facetOptions("channel", ["email", "sms", "whatsapp"])}
          selected={channel}
        />
        <DataTableFacet
          label="Status"
          onChange={(values) =>
            narrow({ status: values.length ? values : undefined })
          }
          options={facetOptions("status", STATUSES)}
          selected={status}
        />
        {channel.length || status.length || q ? (
          <Button
            onClick={() =>
              narrow({ channel: undefined, q: undefined, status: undefined })
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

function TemplateList({
  onChanged,
  onEdit,
}: {
  onChanged: () => Promise<unknown>;
  onEdit: (template: Template) => void;
}) {
  const templates = useQuery(templatesQueryOptions);
  const [reading, setReading] = useState<Template | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    action: "publish" | "discard";
    template: Template;
  } | null>(null);

  const publish = useMutation({
    mutationFn: publishTemplate,
    onError: announce.failed,
    onSuccess: async () => {
      announce.done("Published");
      await onChanged();
    },
  });

  const discard = useMutation({
    mutationFn: deleteTemplate,
    onError: announce.failed,
    onSuccess: async () => {
      announce.done("Draft discarded");
      await onChanged();
    },
  });

  if (templates.isPending) return <Skeleton className="h-64 w-full" />;
  if (templates.isError)
    return (
      <Failed
        error={templates.error}
        onRetry={() => void templates.refetch()}
        what="templates"
      />
    );
  if (templates.data.length === 0) {
    return (
      <Nothing title="No templates yet">
        Create and publish a template before this workspace can send its first
        message.
      </Nothing>
    );
  }

  const selected =
    templates.data.find((template) => template.id === selectedId) ??
    templates.data[0];
  if (!selected) return null;

  return (
    <>
      <div className="template-split">
        <ul className="template-index">
          {templates.data.map((template) => (
            <li key={template.id}>
              <button
                aria-current={template.id === selected.id ? "true" : undefined}
                className="template-index-key"
                onClick={() => setSelectedId(template.id)}
                type="button"
              >
                <span className="template-index-name">{template.key}</span>
                <span className="template-index-meta">
                  {channelLabel(template.channel)} · {template.locale} · v
                  {template.version}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <article className="template-read">
          <header className="template-read-meta">
            <ChannelName channel={selected.channel} />
            <TemplateStatus status={selected.status} />
            <span className="template-index-meta">
              {selected.locale} · v{selected.version}
            </span>
            <div className="template-read-side">
              <time
                className="template-when"
                dateTime={new Date(selected.updatedAt).toISOString()}
                title={exactTime(selected.updatedAt)}
              >
                {relativeTime(selected.updatedAt)}
              </time>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label={`Actions for ${selected.key} on ${selected.channel}`}
                      size="icon"
                      variant="ghost"
                    >
                      <EllipsisIcon aria-hidden="true" strokeWidth={1.5} />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => setReading(selected)}>
                      View template
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(selected)}>
                      {selected.status === "draft"
                        ? "Edit draft"
                        : "Draft a new version"}
                    </DropdownMenuItem>
                    {selected.status === "draft" ? (
                      <DropdownMenuItem
                        onClick={() =>
                          setConfirmation({
                            action: "publish",
                            template: selected,
                          })
                        }
                      >
                        Publish template
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuGroup>
                  {selected.status === "draft" ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() =>
                            setConfirmation({
                              action: "discard",
                              template: selected,
                            })
                          }
                          variant="destructive"
                        >
                          Discard draft
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          {selected.subject ? <h2>{selected.subject}</h2> : null}
          <p className="template-body">{selected.body}</p>
        </article>
      </div>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        open={confirmation !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.action === "publish"
                ? "Publish this template?"
                : "Discard this draft?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {confirmation
                ? confirmation.action === "publish"
                  ? `${confirmation.template.key} · ${channelLabel(confirmation.template.channel)} · ${confirmation.template.locale} · v${confirmation.template.version} will become available for new messages. The currently published version will be retired.`
                  : `${confirmation.template.key} · ${channelLabel(confirmation.template.channel)} · ${confirmation.template.locale} · v${confirmation.template.version} will be permanently removed.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={publish.isPending || discard.isPending}
              onClick={() => {
                if (!confirmation) return;
                const mutation =
                  confirmation.action === "publish" ? publish : discard;
                mutation.mutate(confirmation.template.id, {
                  onSuccess: () => setConfirmation(null),
                });
              }}
              size="sm"
              variant={
                confirmation?.action === "discard" ? "destructive" : "default"
              }
            >
              {confirmation?.action === "publish"
                ? "Publish template"
                : "Discard draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <TemplateDetail onClose={() => setReading(null)} template={reading} />
    </>
  );
}

const suppressionColumnHelper = createDataTableColumnHelper<Suppression>();
const EMPTY_SUPPRESSIONS: Suppression[] = [];

function SuppressionList({
  onSearchChange,
  search,
}: {
  onSearchChange: (change: Partial<SuppressionSearch>) => void;
  search: SuppressionSearch;
}) {
  const queryClient = useQueryClient();
  const {
    channel = [],
    page = 1,
    q = "",
    reason = [],
    size = 25,
    sort = "-createdAt",
  } = search;
  const [query, setQuery] = useState(q);
  const [confirmation, setConfirmation] = useState<Suppression | null>(null);
  const pagination: PaginationState = { pageIndex: page - 1, pageSize: size };
  const debouncedQuery = useDebouncedValue(query);
  const suppressions = useQuery(
    suppressionsQueryOptions({
      channel,
      limit: pagination.pageSize,
      page: pagination.pageIndex + 1,
      search: q,
      sort,
      status: reason,
    }),
  );

  const lift = useMutation({
    mutationFn: liftSuppression,
    onError: announce.failed,
    onSuccess: async () => {
      announce.done("The workspace may write there again");
      await queryClient.invalidateQueries({
        queryKey: ["admin", "notifications"],
      });
    },
  });
  const liftPending = lift.isPending;

  const narrow = (change: Partial<SuppressionSearch>) =>
    onSearchChange({ ...change, page: undefined });
  useEffect(() => {
    if (debouncedQuery.trim() === q) return;
    onSearchChange({
      page: undefined,
      q: debouncedQuery.trim() || undefined,
    });
  }, [debouncedQuery, onSearchChange, q]);

  const sorting = useMemo<SortingState>(
    () =>
      sort
        .split(",")
        .filter(Boolean)
        .map((entry) => ({
          desc: entry.startsWith("-"),
          id: entry.replace(/^-/, ""),
        })),
    [sort],
  );
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
    manualPagination: true,
    manualSorting: true,
    onPaginationChange: (updater) => {
      const next = functionalUpdate(updater, pagination);
      onSearchChange({
        page: next.pageIndex > 0 ? next.pageIndex + 1 : undefined,
        size: next.pageSize === 25 ? undefined : next.pageSize,
      });
    },
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting);
      narrow({
        sort:
          next
            .map((entry) => `${entry.desc ? "-" : ""}${entry.id}`)
            .join(",") || undefined,
      });
    },
    pageCount: suppressions.data?.meta.totalPages ?? 1,
    state: { pagination, sorting },
  });
  const aggregations = suppressions.data?.meta.aggregations;
  const channelOptions = ["email", "sms", "whatsapp"].map((value) => ({
    count:
      aggregations?.channel?.find((bucket) => bucket.value === value)?.count ??
      0,
    label: channelLabel(value),
    value,
  }));
  const reasonOptions = (aggregations?.reason ?? []).map((bucket) => ({
    count: bucket.count,
    label: statusLabel(bucket.value),
    value: bucket.value,
  }));

  return (
    <div className={PANEL}>
      <DataTableToolbar
        onSearchChange={(value) => {
          setQuery(value);
        }}
        search={query}
        searchLabel="Search suppressed destinations"
        searchPlaceholder="Destination"
      >
        <DataTableFacet
          label="Channel"
          onChange={(values) =>
            narrow({ channel: values.length ? values : undefined })
          }
          options={channelOptions}
          selected={channel}
        />
        <DataTableFacet
          label="Reason"
          onChange={(values) =>
            narrow({ reason: values.length ? values : undefined })
          }
          options={reasonOptions}
          selected={reason}
        />
        {channel.length || reason.length || q ? (
          <Button
            onClick={() =>
              narrow({ channel: undefined, q: undefined, reason: undefined })
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
