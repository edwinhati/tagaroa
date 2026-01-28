"use client";

import { transactionQueryOptions } from "@repo/common/lib/query/transaction-query";
import type { Transaction } from "@repo/common/types/transaction";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { List, Plus } from "lucide-react";
import { useState } from "react";
import { TransactionFormDialog } from "./transaction-form-dialog";

const DateCell = ({ date }: { date: string | Date }) => (
  <div className="font-medium">{format(new Date(date), "MMM dd, yyyy")}</div>
);

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
    <span className={type === "EXPENSE" ? "text-red-500" : "text-green-500"}>
      {formatted}
    </span>
  );
};

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
  const [editingTransaction, setEditingTransaction] = useState<
    Transaction | undefined
  >(undefined);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    ...transactionQueryOptions({
      page,
      limit: 10,
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
          <DialogTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Transactions for {category.replace(/_/g, " ")}
          </DialogTitle>
          <DialogDescription>
            {format(startDate, "MMM dd, yyyy")} -{" "}
            {format(endDate, "MMM dd, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-muted-foreground">
            {data?.transactions.length} transaction
            {data?.transactions.length !== 1 ? "s" : ""}
          </div>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Transaction
          </Button>
        </div>

        <div className="mt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[
                "skeleton-1",
                "skeleton-2",
                "skeleton-3",
                "skeleton-4",
                "skeleton-5",
              ].map((key) => (
                <div key={key} className="flex gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          ) : data?.transactions && data.transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.map((transaction) => (
                  <TableRow
                    key={transaction.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setEditingTransaction(transaction)}
                  >
                    <TableCell>
                      <DateCell date={transaction.date} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {transaction.type.replace(/_/g, "-")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AmountCell
                        amount={transaction.amount}
                        currency={transaction.currency}
                        type={transaction.type}
                      />
                    </TableCell>
                    <TableCell>{transaction.account?.name || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {transaction.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-2">No transactions found for this category</p>
              <p className="text-sm">Click "Add Transaction" to create one</p>
            </div>
          )}
        </div>

        {data && data.pagination.total_pages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="flex items-center text-sm">
              Page {page} of {data.pagination.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pagination.total_pages}
            >
              Next
            </Button>
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

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
