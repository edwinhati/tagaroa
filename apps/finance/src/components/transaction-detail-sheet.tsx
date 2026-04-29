"use client";

import {
  PropertyRow,
  SectionHeader,
} from "@repo/common/components/detail-elements";
import type { FilePreviewData } from "@repo/common/components/file-list-item";
import { FileListItem } from "@repo/common/components/file-list-item";
import { FilePreviewDialog } from "@repo/common/components/file-preview-dialog";
import type { Transaction } from "@repo/common/types/transaction";
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
  IconCalendar,
  IconCoin,
  IconFolder,
  IconNotes,
  IconPencil,
  IconReceipt,
  IconTag,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { useState } from "react";

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

function getTypeIcon(type: string) {
  return type === "INCOME" ? IconTrendingUp : IconTrendingDown;
}

function getTypeColor(type: string): string {
  return type === "INCOME"
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "bg-rose-500/10 text-rose-600 dark:text-rose-400";
}

export function TransactionDetailSheet({
  transaction,
  open,
  onOpenChange,
  onEdit,
}: Readonly<TransactionDetailSheetProps>) {
  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const [previewFile, setPreviewFile] = useState<FilePreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  if (!transaction) return null;

  const TypeIcon = getTypeIcon(transaction.type);
  const colorClass = getTypeColor(transaction.type);
  const isIncome = transaction.type === "INCOME";

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
                  <TypeIcon size={24} />
                </div>
                <div className="space-y-1 min-w-0">
                  <SheetTitle className="text-lg leading-tight">
                    {isIncome ? "Income" : "Expense"} Transaction
                  </SheetTitle>
                  <Badge variant="outline" className="text-xs">
                    {transaction.type.replaceAll("_", "-")}
                  </Badge>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="px-6 pb-6">
            <div
              className={cn(
                "rounded-xl p-4",
                isIncome
                  ? "bg-emerald-500/5 border border-emerald-500/10"
                  : "bg-rose-500/5 border border-rose-500/10",
              )}
            >
              <p className="text-xs text-muted-foreground mb-1">Amount</p>
              <p
                className={cn(
                  "text-2xl font-bold tracking-tight",
                  isIncome
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400",
                )}
              >
                {formatAmount(transaction.amount, transaction.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {transaction.currency}
              </p>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-6">
            <div className="space-y-2">
              <SectionHeader icon={IconReceipt} title="Transaction Details" />
              <div className="rounded-lg border border-border/50 px-3">
                <PropertyRow
                  label="Date"
                  value={
                    <div className="flex items-center gap-1.5">
                      <IconCalendar
                        size={14}
                        className="text-muted-foreground"
                      />
                      <span>{format(transaction.date, "MMM dd, yyyy")}</span>
                    </div>
                  }
                />
                <PropertyRow
                  label="Type"
                  value={
                    <Badge variant="outline" className="text-xs">
                      {transaction.type.replaceAll("_", "-")}
                    </Badge>
                  }
                />
                {transaction.account && (
                  <PropertyRow
                    label="Account"
                    value={
                      <div className="flex items-center gap-1.5">
                        <IconBuildingBank
                          size={14}
                          className="text-muted-foreground"
                        />
                        <span>{transaction.account.name}</span>
                      </div>
                    }
                  />
                )}
                {transaction.budget_item && (
                  <PropertyRow
                    label="Category"
                    value={
                      <div className="flex items-center gap-1.5">
                        <IconTag size={14} className="text-muted-foreground" />
                        <span>{transaction.budget_item.category}</span>
                      </div>
                    }
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeader icon={IconCoin} title="Financial Details" />
              <div className="rounded-lg border border-border/50 px-3">
                <PropertyRow
                  label="Amount"
                  value={formatAmount(transaction.amount, transaction.currency)}
                />
                <PropertyRow label="Currency" value={transaction.currency} />
              </div>
            </div>

            {transaction.installment && (
              <div className="space-y-2">
                <SectionHeader icon={IconCalendar} title="Installment" />
                <div className="rounded-lg border border-border/50 px-3">
                  <PropertyRow
                    label="Tenure"
                    value={`${transaction.installment.tenure} months`}
                  />
                  <PropertyRow
                    label="Interest Rate"
                    value={`${transaction.installment.interestRate}%`}
                  />
                  <PropertyRow
                    label="Monthly Amount"
                    value={formatAmount(
                      transaction.installment.monthlyAmount,
                      transaction.currency,
                    )}
                  />
                </div>
              </div>
            )}

            {transaction.notes && (
              <div className="space-y-2">
                <SectionHeader icon={IconNotes} title="Notes" />
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {transaction.notes}
                  </p>
                </div>
              </div>
            )}

            {transaction.files && transaction.files.length > 0 && (
              <div className="space-y-2">
                <SectionHeader icon={IconFolder} title="Files" />
                <div className="rounded-lg border border-border/50 p-2 space-y-1">
                  {transaction.files.map((file) => (
                    <FileListItem
                      key={file}
                      fileId={file}
                      onClick={(data) => {
                        setPreviewFile(data);
                        setShowPreview(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <FilePreviewDialog
          fileId={previewFile?.id ?? null}
          fileName={previewFile?.name}
          contentType={previewFile?.contentType}
          open={showPreview}
          onOpenChange={setShowPreview}
        />

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
            Edit Transaction
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
