"use client";

import { portfoliosQueryOptions } from "@repo/common/lib/query/portfolio-query";
import type { Portfolio } from "@repo/common/types/investment";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import {
  IconActivity,
  IconArrowUpRight,
  IconBriefcase,
  IconCircleFilled,
  IconPlus,
  IconTrendingUp,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

const MODE_CONFIG = {
  live: {
    label: "Live",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
    dot: "text-emerald-500",
  },
  paper: {
    label: "Paper",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20",
    dot: "text-amber-500",
  },
  backtest: {
    label: "Backtest",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
    dot: "text-blue-500",
  },
} as const;

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
  loading: boolean;
}) {
  return (
    <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-md">
      <div className={cn("absolute inset-x-0 top-0 h-0.5", accent)} />
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
        <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </CardTitle>
        <span
          className={cn(
            "rounded-md p-1.5",
            accent.replace("bg-", "bg-").replace("-600", "-500/10"),
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", accent.replace("bg-", "text-"))} />
        </span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <p className="font-mono text-3xl font-semibold tabular-nums">
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PortfolioCard({ portfolio }: { portfolio: Portfolio }) {
  const mode = MODE_CONFIG[portfolio.mode] ?? MODE_CONFIG.paper;
  const isActive = portfolio.status === "active";

  return (
    <Link
      href={`/portfolios/${portfolio.id}`}
      className="group relative flex flex-col gap-3 rounded-xl border bg-card p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-md cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <IconCircleFilled
            className={cn(
              "h-2 w-2 shrink-0",
              isActive ? "text-emerald-500" : "text-muted-foreground/40",
            )}
          />
          <span className="font-semibold leading-tight">{portfolio.name}</span>
        </div>
        <IconArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      </div>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
            mode.bg,
            mode.text,
            mode.border,
          )}
        >
          {mode.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {portfolio.status}
        </span>
      </div>

      <div className="flex items-baseline justify-between border-t pt-3">
        <span className="text-xs text-muted-foreground">Initial capital</span>
        <span className="font-mono text-sm font-medium tabular-nums">
          {portfolio.currency}{" "}
          {portfolio.initialCapital.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </span>
      </div>
    </Link>
  );
}

export function DashboardContent() {
  const { data, isLoading } = useQuery(
    portfoliosQueryOptions({ page: 1, limit: 6 }),
  );
  const portfolios = data?.portfolios ?? [];
  const total = data?.pagination?.total ?? 0;

  const live = portfolios.filter((p) => p.mode === "live").length;
  const active = portfolios.filter((p) => p.status === "active").length;

  const stats = [
    {
      label: "Total Portfolios",
      value: total,
      icon: IconBriefcase,
      accent: "bg-primary",
    },
    {
      label: "Active",
      value: active,
      icon: IconActivity,
      accent: "bg-emerald-600",
    },
    {
      label: "Live",
      value: live,
      icon: IconTrendingUp,
      accent: "bg-amber-500",
    },
  ];

  return (
    <div className="flex flex-col gap-8 p-6 max-w-7xl">
      {/* Stat cards */}
      <section>
        <h2 className="mb-4 border-l-2 border-primary pl-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} loading={isLoading} />
          ))}
        </div>
      </section>

      {/* Recent portfolios */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="border-l-2 border-primary pl-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Recent Portfolios
          </h2>
          <Link
            href="/portfolios"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            View all
            <IconArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {["sk-1", "sk-2", "sk-3"].map((key) => (
              <Skeleton key={key} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : portfolios.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-14 text-center">
            <div className="rounded-full bg-muted p-4">
              <IconBriefcase className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No portfolios yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first portfolio to get started
              </p>
            </div>
            <Link
              href="/portfolios"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer"
            >
              <IconPlus className="h-4 w-4" />
              New Portfolio
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {portfolios.map((portfolio) => (
              <PortfolioCard key={portfolio.id} portfolio={portfolio} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
