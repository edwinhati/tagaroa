"use client";

import { transactionQueryOptions } from "@repo/common/lib/query/transaction-query";
import type { Transaction } from "@repo/common/types/transaction";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  List,
  PencilIcon,
  Plus,
  Receipt,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORY_CONFIG } from "./budget-data-table";
import { TransactionFormDialog } from "./transaction-form-dialog";

// Format currency helper
const formatCurrency = (value: number, currency = "IDR") => {
  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Date cell component
const DateCell = ({ date }: { date: string | Date }) => (
  <div className="font-medium">{format(new Date(date), "MMM dd, yyyy")}</div>
);

// Type badge with colors
const TypeBadge = ({ type }: { type: string }) => {
  const variant =
    type === "EXPENSE"
      ? "destructive"
      : type === "INCOME"
        ? "default"
        : "secondary";

  return (
    <Badge
      variant={variant}
      className={cn(
        "capitalize",
        type === "INCOME" && "bg-emerald-500 hover:bg-emerald-600",
      )}
    >
      {type.toLowerCase()}
    </Badge>
  );
};

// Amount cell with color coding
const AmountCell = ({
  amount,
  currency,
  type,
}: {
  amount: number;
  currency: string;
  type: string;
}) => {
  const displayAmount = type === "EXPENSE" ? -amount : amount;
  const formatted = new Intl.NumberFormat(
    currency === "IDR" ? "id-ID" : "en-US",
    {
      style: "currency",
      currency,
    },
  ).format(displayAmount);
  return (
    <span
      className={cn(
        "font-mono font-medium",
        type === "EXPENSE"
          ? "text-destructive"
          : "text-emerald-600 dark:text-emerald-400",
      )}
    >
      {formatted}
    </span>
  );
};

// Summary stats component
const TransactionSummary = ({
  transactions,
  totalCount,
}: {
  transactions: Transaction[];
  totalCount: number;
}) => {
  const totalSpent = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  const totalIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "INCOME")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  return (
    <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div>
        <p className="text-xs text-muted-foreground">Total Spent</p>
        <p className="text-lg font-bold font-mono text-destructive">
          {formatCurrency(totalSpent)}
        </p>
      </div>
      {totalIncome > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">Total Income</p>
          <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalIncome)}
          </p>
        </div>
      )}
      <div className="ml-auto">
        <p className="text-xs text-muted-foreground">Transactions</p>
        <p className="text-lg font-bold">{totalCount}</p>
      </div>
    </div>
  );
};

// Skeleton loading component
const TransactionTableSkeleton = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Date</TableHead>
        <TableHead>Type</TableHead>
        <TableHead>Amount</TableHead>
        <TableHead>Account</TableHead>
        <TableHead>Notes</TableHead>
        <TableHead className="w-[80px]">
          <span className="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {Array.from({ length: 5 }, (_, i) => i).map((i) => (
        <TableRow
          key={`transaction-skeleton-row-${i}`}
          className="animate-in fade-in-50 duration-300"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

interface TransactionsByCategoryDialogProps {
  category: string;
  budgetItemId: string;
  startDate: Date;
  endDate: Date;
  trigger?: React.ReactElement;
}

export function TransactionsByCategoryDialog({
  category,
  budgetItemId,
  startDate,
  endDate,
  trigger,
}: TransactionsByCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [editingTransaction, setEditingTransaction] = useState<
    Transaction | undefined
  >(undefined);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Get category config for icon/colors
  const categoryKey = category.toLowerCase();
  const categoryConfig = CATEGORY_CONFIG[categoryKey] ??
    CATEGORY_CONFIG.other ?? {
      bg: "bg-slate-100 dark:bg-slate-900/30",
      text: "text-slate-700 dark:text-slate-300",
      icon: Receipt,
    };
  const CategoryIcon = categoryConfig.icon;

  const { data, isLoading } = useQuery({
    ...transactionQueryOptions({
      page,
      limit: pageSize,
      filters: { category: [category] },
      startDate,
      endDate,
    }),
    enabled: open,
  });

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setPage(1);
      setEditingTransaction(undefined);
    }
  };

  const handleTransactionSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["budget"] });
    setEditingTransaction(undefined);
    setAddDialogOpen(false);
  };

  const isEditing = !!editingTransaction?.id;
  const totalPages = data?.pagination?.total_pages ?? 1;
  const totalCount = data?.pagination?.total ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-xs">
            <List className="h-3 w-3 mr-1" />
            View Transactions
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="!max-w-4xl !w-full max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center rounded-lg p-2",
                categoryConfig.bg,
                categoryConfig.text,
              )}
            >
              <CategoryIcon className="h-5 w-5" />
            </div>
            <span className="capitalize">
              {category.replace(/_/g, " ")} Transactions
            </span>
          </DialogTitle>
          <DialogDescription>
            {format(startDate, "MMM dd, yyyy")} –{" "}
            {format(endDate, "MMM dd, yyyy")}
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        {!isLoading && data?.transactions && (
          <TransactionSummary
            transactions={data.transactions}
            totalCount={totalCount}
          />
        )}

        {/* Table */}
        <div className="mt-2">
          {isLoading ? (
            <TransactionTableSkeleton />
          ) : data?.transactions && data.transactions.length > 0 ? (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[80px]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      className={cn(
                        "group/row cursor-pointer",
                        "motion-safe:transition-colors motion-safe:duration-150",
                        "hover:bg-muted/60",
                        "focus-within:bg-muted/40 focus-within:ring-1 focus-within:ring-primary/20 focus-within:ring-inset",
                      )}
                      onClick={() => setEditingTransaction(transaction)}
                    >
                      <TableCell>
                        <DateCell date={transaction.date} />
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={transaction.type} />
                      </TableCell>
                      <TableCell>
                        <AmountCell
                          amount={transaction.amount}
                          currency={transaction.currency}
                          type={transaction.type}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {transaction.account?.name || "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {transaction.notes || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 motion-safe:transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTransaction(transaction);
                            }}
                          >
                            <PencilIcon className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty className="py-12">
              <EmptyMedia
                variant="icon"
                className={cn(categoryConfig.bg, categoryConfig.text)}
              >
                <CategoryIcon className="h-6 w-6" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No Transactions Yet</EmptyTitle>
                <EmptyDescription>
                  No transactions found for {category.replace(/_/g, " ")} in
                  this period. Add your first transaction to start tracking.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Transaction
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} –{" "}
              {Math.min(page * pageSize, totalCount)} of {totalCount}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeftIcon className="h-4 w-4" />
                <span className="sr-only">Previous page</span>
              </Button>
              <span className="flex items-center text-sm min-w-[80px] justify-center">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                <ChevronRightIcon className="h-4 w-4" />
                <span className="sr-only">Next page</span>
              </Button>
            </div>
          </div>
        )}

        <TransactionFormDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          initialData={{
            budget_item_id: budgetItemId,
            type: "EXPENSE",
            date: new Date(),
          }}
          onSuccess={handleTransactionSaved}
        />

        <TransactionFormDialog
          open={isEditing}
          onOpenChange={(open) => !open && setEditingTransaction(undefined)}
          initialData={editingTransaction}
          onSuccess={handleTransactionSaved}
        />

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button
            variant="default"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Transaction
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
