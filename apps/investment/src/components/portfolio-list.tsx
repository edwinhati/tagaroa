"use client";

import { currencies } from "@repo/common/lib/currencies";
import {
  createPortfolioMutationOptions,
  deletePortfolioMutationOptions,
  portfoliosQueryOptions,
} from "@repo/common/lib/query/portfolio-query";
import type { Portfolio } from "@repo/common/types/investment";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import {
  IconArrowUpRight,
  IconBriefcase,
  IconCircleFilled,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";

const MODE_CONFIG = {
  live: {
    label: "Live",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  paper: {
    label: "Paper",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
  },
  backtest: {
    label: "Backtest",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
    dot: "bg-blue-500",
  },
} as const;

function CreatePortfolioDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Portfolio["mode"]>("paper");
  const [initialCapital, setInitialCapital] = useState("10000");
  const [currency, setCurrency] = useState("USD");

  const { mutate, isPending } = useMutation({
    ...createPortfolioMutationOptions(),
    onSuccess: () => {
      setOpen(false);
      setName("");
      setInitialCapital("10000");
      toast.success("Portfolio created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="sm" className="gap-1.5" type="button" />}
      >
        <IconPlus className="h-4 w-4" />
        New Portfolio
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Portfolio</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-5 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutate({
              name,
              mode,
              initialCapital: Number(initialCapital),
              currency,
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-name">Portfolio name</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BTC Momentum Strategy"
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-mode">Mode</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as Portfolio["mode"])}
            >
              <SelectTrigger id="p-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paper">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Paper — simulated, no real money
                  </span>
                </SelectItem>
                <SelectItem value="backtest">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Backtest — historical data replay
                  </span>
                </SelectItem>
                <SelectItem value="live">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live — real execution
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-capital">Initial Capital</Label>
              <NumericFormat
                id="p-capital"
                customInput={Input}
                thousandSeparator=","
                decimalSeparator="."
                decimalScale={2}
                allowNegative={false}
                value={initialCapital}
                onValueChange={(vals) => setInitialCapital(vals.value)}
                placeholder="10,000.00"
                className="font-mono tabular-nums"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-currency">Currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v ?? "")}
              >
                <SelectTrigger id="p-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={isPending} className="mt-1">
            {isPending ? "Creating…" : "Create Portfolio"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PortfolioCard({
  portfolio,
  onDelete,
}: {
  portfolio: Portfolio;
  onDelete: (id: string) => void;
}) {
  const mode = MODE_CONFIG[portfolio.mode] ?? MODE_CONFIG.paper;
  const isActive = portfolio.status === "active";

  return (
    <div className="group relative flex flex-col rounded-xl border bg-card transition-all duration-200 hover:border-primary/30 hover:shadow-md overflow-hidden">
      <div className="flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <IconCircleFilled
              className={cn(
                "h-2 w-2 shrink-0",
                isActive ? "text-emerald-500" : "text-muted-foreground/30",
              )}
            />
            <span className="font-semibold truncate">{portfolio.name}</span>
          </div>
          <button
            type="button"
            onClick={() => portfolio.id && onDelete(portfolio.id)}
            className="invisible shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:visible cursor-pointer"
            aria-label="Delete portfolio"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Mode badge */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
              mode.bg,
              mode.text,
              mode.border,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", mode.dot)} />
            {mode.label}
          </span>
          <span className="text-xs capitalize text-muted-foreground">
            {portfolio.status}
          </span>
        </div>

        {/* Capital */}
        <div className="flex items-baseline justify-between border-t pt-4">
          <span className="text-xs text-muted-foreground">Capital</span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {portfolio.currency}{" "}
            {portfolio.initialCapital.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}
          </span>
        </div>

        {/* View link */}
        <Link
          href={`/portfolios/${portfolio.id}`}
          className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
        >
          View portfolio
          <IconArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function PortfolioList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery(
    portfoliosQueryOptions({ page, limit: 12 }),
  );
  const portfolios = data?.portfolios ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.total_pages ?? 1;

  const { mutate: deletePortfolio } = useMutation({
    ...deletePortfolioMutationOptions(),
    onSuccess: () => toast.success("Portfolio deleted"),
    onError: (err: Error) => toast.error(err.message),
  });

  function handleDelete(id: string) {
    if (!confirm("Permanently delete this portfolio?")) return;
    deletePortfolio(id);
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {isLoading ? (
            <Skeleton className="inline-block h-4 w-24" />
          ) : (
            `${total} portfolio${total !== 1 ? "s" : ""}`
          )}
        </div>
        <CreatePortfolioDialog />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {["sk-1", "sk-2", "sk-3", "sk-4", "sk-5", "sk-6"].map((key) => (
            <Skeleton key={key} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : portfolios.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
          <div className="rounded-full bg-muted p-4">
            <IconBriefcase className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No portfolios yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create one to start tracking strategies
            </p>
          </div>
          <CreatePortfolioDialog />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portfolios.map((portfolio) => (
            <PortfolioCard
              key={portfolio.id}
              portfolio={portfolio}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
