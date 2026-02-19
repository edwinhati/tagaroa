"use client";

import { transactionQueryOptions } from "@repo/common/lib/query/transaction-query";
import { Badge } from "@repo/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { IconArrowDownRight, IconArrowUpRight } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { formatCurrency } from "@/utils/currency";

interface CategoryTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  range?: DateRange;
}

export function CategoryTransactionsDialog({
  open,
  onOpenChange,
  category,
  range,
}: CategoryTransactionsDialogProps) {
  const { data, isLoading } = useQuery({
    ...transactionQueryOptions({
      page: 1,
      limit: 50,
      filters: {
        category: [category],
      },
      startDate: range?.from,
      endDate: range?.to,
    }),
    enabled: open,
  });

  const transactions = data?.transactions ?? [];
  const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transactions: {category}</DialogTitle>
          <DialogDescription>
            {transactions.length} transaction(s) found
            {totalAmount !== 0 && (
              <> · Total: {formatCurrency(Math.abs(totalAmount), "IDR")}</>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton
                // biome-ignore lint/suspicious/noArrayIndexKey: Static array for skeleton loading
                key={i}
                className="h-12 w-full"
              />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No transactions found for this category
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      {transaction.date
                        ? format(transaction.date, "MMM dd, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {transaction.notes || "—"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          transaction.type === "INCOME"
                            ? "default"
                            : "secondary"
                        }
                        className="gap-1"
                      >
                        {transaction.type === "INCOME" ? (
                          <IconArrowUpRight className="h-3 w-3" />
                        ) : (
                          <IconArrowDownRight className="h-3 w-3" />
                        )}
                        {transaction.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span
                        className={
                          transaction.type === "INCOME"
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }
                      >
                        {transaction.type === "INCOME" ? "+" : "-"}
                        {formatCurrency(
                          Math.abs(transaction.amount || 0),
                          transaction.currency || "IDR",
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
