"use client";

import type { Budget, BudgetItem } from "@repo/common/types/budget";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import {
  IconCalendar,
  IconChartPie,
  IconCoin,
  IconPencil,
  IconTag,
} from "@tabler/icons-react";

interface BudgetHistoryDetailSheetProps {
  budget: Budget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

function SectionHeader({
  icon: Icon,
  title,
}: Readonly<{
  icon: React.ElementType;
  title: string;
}>) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon size={14} />
      <span className="text-xs font-semibold uppercase tracking-wider">
        {title}
      </span>
    </div>
  );
}

function PropertyRow({
  label,
  value,
  className,
}: Readonly<{
  label: string;
  value: React.ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2.5 border-b border-border/50 last:border-0",
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function BudgetItemRow({
  item,
  currency,
}: Readonly<{ item: BudgetItem; currency: string }>) {
  const percentage =
    item.allocation > 0 ? (item.spent / item.allocation) * 100 : 0;
  const isOverBudget = item.spent > item.allocation;

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-lg p-1.5 bg-primary/10 text-primary">
            <IconTag className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-medium">{item.category}</span>
        </div>
        <Badge
          variant={isOverBudget ? "destructive" : "secondary"}
          className="text-xs"
        >
          {formatAmount(item.spent)} / {formatAmount(item.allocation)}
        </Badge>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{percentage.toFixed(1)}% used</span>
          <span>{isOverBudget ? "Over budget" : "Within budget"}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isOverBudget
                ? "bg-destructive"
                : percentage > 80
                  ? "bg-amber-500"
                  : "bg-emerald-500",
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function BudgetHistoryDetailSheet({
  budget,
  open,
  onOpenChange,
  onEdit,
}: Readonly<BudgetHistoryDetailSheetProps>) {
  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1).toLocaleString("en-US", { month: "long" });
  };

  const totalSpent =
    budget?.items?.reduce((sum, item) => sum + (item.spent || 0), 0) || 0;
  const spentPercentage =
    budget && budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;

  if (!budget) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full flex-col w-full sm:max-w-sm p-0"
      >
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 pb-4">
            <SheetHeader className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <IconCalendar size={24} />
                </div>
                <div className="space-y-1 min-w-0">
                  <SheetTitle className="text-lg leading-tight">
                    {getMonthName(budget.month)} {budget.year}
                  </SheetTitle>
                  <Badge variant="outline" className="text-xs">
                    {budget.currency}
                  </Badge>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="px-6 pb-6">
            <div className="rounded-xl p-4 bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {formatAmount(budget.amount, budget.currency)}
              </p>
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {formatAmount(totalSpent, budget.currency)} spent
                  </span>
                  <span
                    className={cn(
                      spentPercentage > 100
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {spentPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      spentPercentage > 100
                        ? "bg-destructive"
                        : spentPercentage > 80
                          ? "bg-amber-500"
                          : "bg-emerald-500",
                    )}
                    style={{ width: `${Math.min(spentPercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-6">
            <div className="space-y-2">
              <SectionHeader icon={IconCoin} title="Budget Details" />
              <div className="rounded-lg border border-border/50 px-3">
                <PropertyRow
                  label="Period"
                  value={`${getMonthName(budget.month)} ${budget.year}`}
                />
                <PropertyRow
                  label="Total Amount"
                  value={formatAmount(budget.amount, budget.currency)}
                />
                <PropertyRow
                  label="Currency"
                  value={<Badge variant="outline">{budget.currency}</Badge>}
                />
              </div>
            </div>

            {budget.items && budget.items.length > 0 && (
              <div className="space-y-2">
                <SectionHeader icon={IconChartPie} title="Category Breakdown" />
                <div className="rounded-lg border border-border/50 px-3">
                  {budget.items.map((item, index, arr) => (
                    <div
                      key={item.id || item.category}
                      className={cn(
                        index === arr.length - 1
                          ? ""
                          : "border-b border-border/50",
                      )}
                    >
                      <BudgetItemRow item={item} currency={budget.currency} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t p-4 bg-background">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              onEdit?.();
            }}
          >
            <IconPencil className="mr-2 h-4 w-4" />
            Edit Budget
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
