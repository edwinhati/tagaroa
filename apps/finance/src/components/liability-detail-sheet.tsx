"use client";

import type { Liability } from "@repo/common/types/liability";
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
  IconCheck,
  IconCreditCard,
  IconCurrencyDollar,
  IconNotes,
  IconPencil,
  IconProgress,
} from "@tabler/icons-react";
import { format } from "date-fns";

interface LiabilityDetailSheetProps {
  liability: Liability | null;
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

export function LiabilityDetailSheet({
  liability,
  open,
  onOpenChange,
  onEdit,
}: Readonly<LiabilityDetailSheetProps>) {
  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  if (!liability) return null;

  const isPaid = !!liability.paidAt;

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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                  <IconCreditCard size={24} />
                </div>
                <div className="space-y-1 min-w-0">
                  <SheetTitle className="text-lg leading-tight">
                    {liability.name}
                  </SheetTitle>
                  <Badge variant="outline" className="text-xs">
                    {liability.type.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="px-6 pb-6">
            <div className="rounded-xl p-4 bg-red-500/5 border border-red-500/10">
              <p className="text-xs text-muted-foreground mb-1">Amount</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {formatAmount(liability.amount, liability.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {liability.currency}
              </p>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-6">
            <div className="space-y-2">
              <SectionHeader icon={IconCreditCard} title="Liability Details" />
              <div className="rounded-lg border border-border/50 px-3">
                <PropertyRow label="Name" value={liability.name} />
                <PropertyRow
                  label="Type"
                  value={
                    <Badge variant="outline" className="text-xs">
                      {liability.type.replaceAll("_", " ")}
                    </Badge>
                  }
                />
                <PropertyRow
                  label="Status"
                  value={
                    isPaid ? (
                      <Badge
                        variant="outline"
                        className="text-xs text-green-600"
                      >
                        <IconCheck className="mr-1 h-3 w-3" />
                        Paid
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs text-yellow-600"
                      >
                        Unpaid
                      </Badge>
                    )
                  }
                />
                <PropertyRow label="Currency" value={liability.currency} />
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeader
                icon={IconCurrencyDollar}
                title="Financial Details"
              />
              <div className="rounded-lg border border-border/50 px-3">
                <PropertyRow
                  label="Amount"
                  value={formatAmount(liability.amount, liability.currency)}
                />
                {liability.originalAmount !== undefined &&
                  liability.originalAmount !== liability.amount && (
                    <PropertyRow
                      label="Original Amount"
                      value={formatAmount(
                        liability.originalAmount,
                        liability.currency,
                      )}
                    />
                  )}
                {liability.totalAmount !== undefined && (
                  <PropertyRow
                    label="Total Amount"
                    value={formatAmount(
                      liability.totalAmount,
                      liability.currency,
                    )}
                  />
                )}
                {liability.totalInterest !== undefined && (
                  <PropertyRow
                    label="Total Interest"
                    value={formatAmount(
                      liability.totalInterest,
                      liability.currency,
                    )}
                  />
                )}
              </div>
            </div>

            {liability.installmentMetadata && (
              <div className="space-y-2">
                <SectionHeader
                  icon={IconProgress}
                  title="Installment Progress"
                />
                <div className="rounded-lg border border-border/50 px-3">
                  <PropertyRow
                    label="Tenure"
                    value={`${liability.installmentMetadata.tenure} months`}
                  />
                  <PropertyRow
                    label="Interest Rate"
                    value={`${liability.installmentMetadata.interestRate}%`}
                  />
                  <PropertyRow
                    label="Monthly Amount"
                    value={formatAmount(
                      liability.installmentMetadata.monthlyAmount,
                      liability.currency,
                    )}
                  />
                  {liability.remainingMonths !== undefined && (
                    <PropertyRow
                      label="Remaining Months"
                      value={liability.remainingMonths.toString()}
                    />
                  )}
                  {liability.installmentNumber !== undefined && (
                    <PropertyRow
                      label="Installment Number"
                      value={`#${liability.installmentNumber}`}
                    />
                  )}
                  <div className="py-3">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {Math.round(
                          ((liability.installmentMetadata.tenure -
                            (liability.remainingMonths ?? 0)) /
                            liability.installmentMetadata.tenure) *
                            100,
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${Math.round(
                            ((liability.installmentMetadata.tenure -
                              (liability.remainingMonths ?? 0)) /
                              liability.installmentMetadata.tenure) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isPaid && liability.paidAt && (
              <div className="space-y-2">
                <SectionHeader icon={IconCalendar} title="Payment Details" />
                <div className="rounded-lg border border-border/50 px-3">
                  <PropertyRow
                    label="Paid At"
                    value={format(new Date(liability.paidAt), "MMM d, yyyy")}
                  />
                </div>
              </div>
            )}

            {liability.notes && (
              <div className="space-y-2">
                <SectionHeader icon={IconNotes} title="Notes" />
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {liability.notes}
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
            Edit Liability
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
