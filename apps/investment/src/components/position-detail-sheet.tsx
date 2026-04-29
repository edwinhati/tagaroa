"use client";

import type { PositionWithPnl } from "@repo/common/types/investment";
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
  IconChartBar,
  IconChartLine,
  IconCoin,
  IconHash,
  IconPencil,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react";

interface PositionDetailSheetProps {
  position: PositionWithPnl | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  onClosePosition?: () => void;
}

function getAssetClassColor(assetClass: string): string {
  const colors: Record<string, string> = {
    STOCK: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    CRYPTO: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    FOREX: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    ETF: "bg-green-500/10 text-green-600 dark:text-green-400",
    COMMODITY: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  return colors[assetClass] || "bg-muted text-muted-foreground";
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

export function PositionDetailSheet({
  position,
  open,
  onOpenChange,
  onEdit,
  onClosePosition,
}: Readonly<PositionDetailSheetProps>) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  if (!position) return null;

  const isProfitable = position.unrealizedPnl >= 0;
  const isLong = position.side === "LONG";
  const colorClass = getAssetClassColor(position.assetClass);

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
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                    colorClass,
                  )}
                >
                  <IconChartLine size={24} />
                </div>
                <div className="space-y-1 min-w-0">
                  <SheetTitle className="text-lg leading-tight">
                    {position.ticker}
                  </SheetTitle>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", colorClass)}
                  >
                    {position.assetClass}
                  </Badge>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="px-6 pb-6">
            <div
              className={cn(
                "rounded-xl p-4",
                isProfitable
                  ? "bg-emerald-500/5 border border-emerald-500/10"
                  : "bg-red-500/5 border border-red-500/10",
              )}
            >
              <p className="text-xs text-muted-foreground mb-1">
                Unrealized P&L
              </p>
              <p
                className={cn(
                  "text-2xl font-bold tracking-tight",
                  isProfitable ? "text-emerald-600" : "text-red-600",
                )}
              >
                {formatCurrency(position.unrealizedPnl)}
              </p>
              <p
                className={cn(
                  "text-xs mt-1",
                  isProfitable ? "text-emerald-600" : "text-red-600",
                )}
              >
                {formatPercentage(position.unrealizedPnlPct)}
              </p>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-6">
            <div className="space-y-2">
              <SectionHeader icon={IconHash} title="Position Details" />
              <div className="rounded-lg border border-border/50 px-3">
                <PropertyRow label="Ticker" value={position.ticker} />
                <PropertyRow
                  label="Asset Class"
                  value={
                    <Badge variant="outline" className="text-xs">
                      {position.assetClass}
                    </Badge>
                  }
                />
                <PropertyRow
                  label="Side"
                  value={
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        isLong
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {isLong ? (
                        <IconTrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <IconTrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {position.side}
                    </Badge>
                  }
                />
                <PropertyRow
                  label="Opened At"
                  value={new Date(position.openedAt).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    },
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeader icon={IconCoin} title="Financial Details" />
              <div className="rounded-lg border border-border/50 px-3">
                <PropertyRow
                  label="Quantity"
                  value={position.quantity.toLocaleString("en-US")}
                />
                <PropertyRow
                  label="Average Cost"
                  value={formatCurrency(position.averageCost)}
                />
                <PropertyRow
                  label="Current Price"
                  value={formatCurrency(position.currentPrice)}
                />
                <PropertyRow
                  label="Market Value"
                  value={formatCurrency(position.marketValue)}
                />
                <PropertyRow
                  label="Cost Basis"
                  value={formatCurrency(position.costBasis)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeader icon={IconChartBar} title="Performance" />
              <div className="rounded-lg border border-border/50 px-3">
                <PropertyRow
                  label="Unrealized P&L"
                  value={
                    <span
                      className={
                        isProfitable ? "text-emerald-600" : "text-red-600"
                      }
                    >
                      {formatCurrency(position.unrealizedPnl)}
                    </span>
                  }
                />
                <PropertyRow
                  label="P&L %"
                  value={
                    <span
                      className={
                        isProfitable ? "text-emerald-600" : "text-red-600"
                      }
                    >
                      {formatPercentage(position.unrealizedPnlPct)}
                    </span>
                  }
                />
                <PropertyRow
                  label="Weight"
                  value={`${(position.weight * 100).toFixed(2)}%`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeader icon={IconCalendar} title="Status" />
              <div className="rounded-lg border border-border/50 px-3">
                <PropertyRow
                  label="Price Status"
                  value={
                    position.isStale ? (
                      <Badge
                        variant="outline"
                        className="text-xs border-amber-500/20 bg-amber-500/10 text-amber-600"
                      >
                        Stale
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                      >
                        Live
                      </Badge>
                    )
                  }
                />
                {position.isStale && position.priceDate && (
                  <PropertyRow
                    label="Last Price Date"
                    value={new Date(position.priceDate).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t p-4 bg-background space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              onEdit?.();
            }}
          >
            <IconPencil className="mr-2 h-4 w-4" />
            Edit Position
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              onClosePosition?.();
            }}
          >
            Close Position
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
