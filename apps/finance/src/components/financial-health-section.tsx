"use client";

import {
  insightsQueryOptions,
  netWorthQueryOptions,
} from "@repo/common/lib/query/finance-dashboard-query";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconBriefcase,
  IconCreditCard,
  IconTrendingUp,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { formatCurrencyCompact } from "@/utils/currency";
import { MiniSparkline } from "./mini-sparkline";

type FinancialHealthSectionProps = Readonly<{
  range?: DateRange;
}>;

type HealthCardProps = Readonly<{
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "stable";
  icon?: React.ReactNode;
  iconBgColor?: string;
  sparklineData?: ReadonlyArray<{ readonly value: number }>;
  className?: string;
}>;

const HealthCard = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  iconBgColor,
  sparklineData,
  className,
}: HealthCardProps) => {
  return (
    <Card
      className={cn(
        "relative border-border/40",
        "bg-card/60 backdrop-blur-md",
        "shadow-sm",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        {icon && (
          <div
            className={cn(
              "flex items-center justify-center p-2.5 rounded-xl",
              "ring-1 ring-current/20",
              iconBgColor,
            )}
          >
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <div className="text-3xl font-bold tracking-tight">{value}</div>
          {trend && trend !== "stable" && (
            <div className="flex items-center gap-0.5">
              {trend === "up" && (
                <span className="flex items-center gap-0.5 text-emerald-500 text-sm font-medium">
                  <IconArrowUpRight className="h-4 w-4" />
                </span>
              )}
              {trend === "down" && (
                <span className="flex items-center gap-0.5 text-rose-500 text-sm font-medium">
                  <IconArrowDownRight className="h-4 w-4" />
                </span>
              )}
            </div>
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-3">
            <MiniSparkline
              data={sparklineData}
              className="h-12 w-full"
              color="hsl(var(--primary))"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const LoadingSkeleton = () => (
  <div className="grid gap-6 md:grid-cols-4">
    {["sk-1", "sk-2", "sk-3", "sk-4"].map((key) => (
      <Card key={key} className="border-border/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    ))}
  </div>
);

export function FinancialHealthSection({ range }: FinancialHealthSectionProps) {
  const startDate = range?.from
    ? format(range.from, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");
  const endDate = range?.to
    ? format(range.to, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const {
    data: netWorthData,
    isLoading: isLoadingNetWorth,
    isError: isErrorNetWorth,
  } = useQuery(
    netWorthQueryOptions({
      startDate,
      endDate,
    }),
  );

  const {
    data: insightsData,
    isLoading: isLoadingInsights,
    isError: isErrorInsights,
  } = useQuery(
    insightsQueryOptions({
      startDate,
      endDate,
    }),
  );

  const isLoading = isLoadingNetWorth || isLoadingInsights;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Show error state if net worth fails (critical data)
  if (isErrorNetWorth || !netWorthData) {
    return (
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="col-span-4 border-border/50">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Unable to load financial health data
              </p>
              <p className="text-xs text-muted-foreground">
                Please check your backend connection
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Insights are optional - continue without them if they fail
  if (isErrorInsights || !insightsData) {
    // Just show net worth data without insights
  }

  // Calculate trend for net worth based on historical snapshots
  const getTrend = (): "up" | "down" | "stable" => {
    if (!netWorthData.snapshots || netWorthData.snapshots.length < 2) {
      return "stable";
    }
    const latest = netWorthData.snapshots[netWorthData.snapshots.length - 1];
    const previous = netWorthData.snapshots[netWorthData.snapshots.length - 2];
    if (!latest || !previous) return "stable";

    const diff = latest.net_worth - previous.net_worth;
    if (Math.abs(diff) < 0.01) return "stable";
    return diff > 0 ? "up" : "down";
  };

  // Prepare sparkline data from snapshots
  const sparklineData = netWorthData.snapshots.map((snapshot) => ({
    value: snapshot.net_worth,
  }));

  // Check if data is empty (all zeros)
  const hasData =
    netWorthData.current_net_worth !== 0 ||
    netWorthData.total_assets !== 0 ||
    netWorthData.total_liabilities !== 0;

  // If no data, show empty state
  if (!hasData) {
    return (
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-4 border-dashed border-2 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="rounded-full bg-primary/10 p-4">
              <IconTrendingUp className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Track Your Net Worth</h3>
              <p className="text-sm text-slate-400 max-w-md">
                Start tracking your financial health by adding assets and
                liabilities. Connect your accounts to automatically monitor your
                net worth over time.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-4">
      {/* Net Worth Card */}
      <HealthCard
        title="Net Worth"
        value={formatCurrencyCompact(
          netWorthData.current_net_worth,
          netWorthData.currency,
        )}
        subtitle={`${netWorthData.snapshots.length} snapshots tracked`}
        trend={getTrend()}
        icon={<IconTrendingUp className="h-4 w-4" />}
        iconBgColor="text-violet-500 bg-violet-500/10"
        sparklineData={sparklineData}
        className="md:col-span-2"
      />

      {/* Assets Card */}
      <HealthCard
        title="Total Assets"
        value={formatCurrencyCompact(
          netWorthData.total_assets,
          netWorthData.currency,
        )}
        icon={<IconBriefcase className="h-4 w-4" />}
        iconBgColor="text-emerald-500 bg-emerald-500/10"
      />

      {/* Liabilities Card */}
      <HealthCard
        title="Total Liabilities"
        value={formatCurrencyCompact(
          netWorthData.total_liabilities,
          netWorthData.currency,
        )}
        icon={<IconCreditCard className="h-4 w-4" />}
        iconBgColor="text-rose-500 bg-rose-500/10"
      />
    </div>
  );
}
