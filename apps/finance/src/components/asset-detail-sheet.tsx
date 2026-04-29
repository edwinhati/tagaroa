"use client";

import {
  PropertyRow,
  SectionHeader,
} from "@repo/common/components/detail-elements";
import type { Asset } from "@repo/common/types/asset";
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
  IconChartBar,
  IconCoin,
  IconCurrencyDollar,
  IconHash,
  IconNotes,
  IconPencil,
  IconTag,
} from "@tabler/icons-react";

interface AssetDetailSheetProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

function getAssetColor(type: string): string {
  const colors: Record<string, string> = {
    STOCK: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    BOND: "bg-green-500/10 text-green-600 dark:text-green-400",
    REAL_ESTATE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    COMMODITY: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    CRYPTO: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    CASH: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    ETF: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    MUTUAL_FUND: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  };
  return colors[type] || "bg-muted text-muted-foreground";
}

function getAssetIcon(type: string) {
  switch (type) {
    case "STOCK":
    case "ETF":
      return IconChartBar;
    case "BOND":
    case "MUTUAL_FUND":
      return IconCoin;
    case "REAL_ESTATE":
      return IconTag;
    case "COMMODITY":
    case "CRYPTO":
      return IconCurrencyDollar;
    case "CASH":
      return IconCoin;
    default:
      return IconChartBar;
  }
}

export function AssetDetailSheet({
  asset,
  open,
  onOpenChange,
  onEdit,
}: Readonly<AssetDetailSheetProps>) {
  const formatValue = (value: number, currency: string) => {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currency,
    }).format(value);
  };

  if (!asset) return null;

  const AssetIcon = getAssetIcon(asset.type);
  const colorClass = getAssetColor(asset.type);

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
                  <AssetIcon size={24} />
                </div>
                <div className="space-y-1 min-w-0">
                  <SheetTitle className="text-lg leading-tight">
                    {asset.name}
                  </SheetTitle>
                  <Badge variant="outline" className="text-xs">
                    {asset.type.replaceAll("_", "-")}
                  </Badge>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="px-6 pb-6">
            <div className="rounded-xl p-4 bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground mb-1">
                Current Value
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {formatValue(asset.value, asset.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {asset.currency}
              </p>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-6">
            <div className="space-y-2">
              <SectionHeader icon={IconTag} title="Asset Details" />
              <div className="rounded-lg border border-border/50 px-3">
                <PropertyRow label="Asset Name" value={asset.name} />
                <PropertyRow
                  label="Type"
                  value={
                    <Badge variant="outline" className="text-xs">
                      {asset.type.replaceAll("_", "-")}
                    </Badge>
                  }
                />
                {asset.ticker && (
                  <PropertyRow
                    label="Ticker"
                    value={<span className="font-mono">{asset.ticker}</span>}
                  />
                )}
                <PropertyRow label="Currency" value={asset.currency} />
              </div>
            </div>

            {asset.shares !== undefined && asset.shares !== null && (
              <div className="space-y-2">
                <SectionHeader icon={IconHash} title="Financial Details" />
                <div className="rounded-lg border border-border/50 px-3">
                  <PropertyRow
                    label="Total Value"
                    value={formatValue(asset.value, asset.currency)}
                  />
                  <PropertyRow
                    label="Shares"
                    value={asset.shares.toLocaleString()}
                  />
                </div>
              </div>
            )}

            {asset.notes && (
              <div className="space-y-2">
                <SectionHeader icon={IconNotes} title="Notes" />
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {asset.notes}
                  </p>
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
            Edit Asset
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
