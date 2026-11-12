import { AppTrail, Page } from "@repo/shell/app-shell";
import { Button } from "@repo/ui/components/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@repo/ui/components/chart";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  COLLECTION,
  COLUMN,
  Failed,
  FIGURE,
  Mark,
  PANEL,
  SECTION,
  SurfaceBanner,
} from "../../../components/admin-surface";
import {
  ChannelName,
  channelLabel,
} from "../../../components/notification-status";
import {
  type ChannelHealth,
  type Overview,
  overviewQueryOptions,
} from "../../../lib/notifications";

export const Route = createFileRoute("/_shell/notifications/overview")({
  component: NotificationOverviewPage,
});

function NotificationOverviewPage() {
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
