"use client";

import type { Account } from "@repo/common/types/account";
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
  IconBuildingBank,
  IconCoin,
  IconInfoCircle,
  IconNotes,
  IconPencil,
  IconTag,
  IconWallet,
} from "@tabler/icons-react";

interface AccountDetailSheetProps {
  account: Account | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

function getAccountColor(type: string): string {
  const colors: Record<string, string> = {
    BANK: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    "CREDIT-CARD": "bg-red-500/10 text-red-600 dark:text-red-400",
    "PAY-LATER": "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    CASH: "bg-green-500/10 text-green-600 dark:text-green-400",
    "E-WALLET": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    INVESTMENT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  return colors[type] || "bg-muted text-muted-foreground";
}

function getAccountIcon(type: string) {
  switch (type) {
    case "BANK":
      return IconBuildingBank;
    case "CREDIT-CARD":
    case "PAY-LATER":
      return IconWallet;
    case "CASH":
      return IconCoin;
    case "INVESTMENT":
      return IconTag;
    default:
      return IconWallet;
  }
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

export function AccountDetailSheet({
  account,
  open,
  onOpenChange,
  onEdit,
}: Readonly<AccountDetailSheetProps>) {
  const formatBalance = (balance: number, currency: string) => {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currency,
    }).format(balance);
  };

  if (!account) return null;

  const AccountIcon = getAccountIcon(account.type);
  const colorClass = getAccountColor(account.type);

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
                  <AccountIcon size={24} />
                </div>
                <div className="space-y-1 min-w-0">
                  <SheetTitle className="text-lg leading-tight">
                    {account.name}
                  </SheetTitle>
                  <Badge variant="outline" className="text-xs">
                    {account.type.replaceAll("_", "-")}
                  </Badge>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="px-6 pb-6">
            <div
              className={cn(
                "rounded-xl p-4",
                account.balance < 0
                  ? "bg-red-500/5 border border-red-500/10"
                  : "bg-primary/5 border border-primary/10",
              )}
            >
              <p className="text-xs text-muted-foreground mb-1">
                Current Balance
              </p>
              <p
                className={cn(
                  "text-2xl font-bold tracking-tight",
                  account.balance < 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {formatBalance(account.balance, account.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {account.currency}
              </p>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-6">
            <div className="space-y-2">
              <SectionHeader icon={IconInfoCircle} title="Account Details" />
              <div className="rounded-lg border border-border/50 px-3">
                <PropertyRow label="Account Name" value={account.name} />
                <PropertyRow
                  label="Type"
                  value={
                    <Badge variant="outline" className="text-xs">
                      {account.type.replaceAll("_", "-")}
                    </Badge>
                  }
                />
                <PropertyRow label="Currency" value={account.currency} />
              </div>
            </div>

            {account.notes && (
              <div className="space-y-2">
                <SectionHeader icon={IconNotes} title="Notes" />
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {account.notes}
                  </p>
                </div>
              </div>
            )}

            {account.metadata && Object.keys(account.metadata).length > 0 && (
              <div className="space-y-2">
                <SectionHeader icon={IconTag} title="Additional Info" />
                <div className="rounded-lg border border-border/50 px-3">
                  {Object.entries(account.metadata)
                    .filter(
                      ([_key, value]) =>
                        value !== undefined && value !== null && value !== "",
                    )
                    .map(([key, value], index, arr) => {
                      const formattedValue = (() => {
                        if (key === "creditLimit" || key === "minimumPayment") {
                          return formatBalance(Number(value), account.currency);
                        }
                        if (key === "interestRate") {
                          return `${value}%`;
                        }
                        if (key === "billingCycleDay") {
                          return `Day ${value}`;
                        }
                        return String(value);
                      })();

                      return (
                        <PropertyRow
                          key={key}
                          label={key
                            .replace(/([A-Z])/g, " $1")
                            .replace(/^./, (str) => str.toUpperCase())}
                          value={formattedValue}
                          className={index === arr.length - 1 ? "border-0" : ""}
                        />
                      );
                    })}
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
            Edit Account
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
