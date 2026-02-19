"use client";

import { accountQueryOptions } from "@repo/common/lib/query/account-query";
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
import { IconBuilding } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/utils/currency";

interface AccountDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountType?: string;
}

export function AccountDetailDialog({
  open,
  onOpenChange,
  accountType,
}: AccountDetailDialogProps) {
  const { data, isLoading } = useQuery({
    ...accountQueryOptions({
      page: 1,
      limit: 50,
      filters: accountType ? { type: [accountType] } : {},
    }),
    enabled: open,
  });

  const accounts = data?.accounts ?? [];
  const totalBalance = accounts.reduce(
    (sum, acc) => sum + (acc.balance || 0),
    0,
  );

  const title = accountType
    ? `${accountType.charAt(0).toUpperCase()}${accountType.slice(1).toLowerCase().replace(/-/g, " ")} Accounts`
    : "All Accounts";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconBuilding className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {accounts.length} account(s) found · Total balance:{" "}
            {formatCurrency(totalBalance, "IDR")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton
                // biome-ignore lint/suspicious/noArrayIndexKey: Static array for skeleton loading
                key={i}
                className="h-16 w-full"
              />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No accounts found
              {accountType && ` for type: ${accountType}`}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  {/* <TableHead>Institution</TableHead> */}
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{account.name}</div>
                        {/* {account.account_number && (
                          <div className="text-xs text-muted-foreground">
                            {account.account_number}
                          </div>
                        )} */}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {account.type?.replace(/-/g, " ")}
                      </Badge>
                    </TableCell>
                    {/* <TableCell className="text-muted-foreground">
                      {account.institution || "—"}
                    </TableCell> */}
                    <TableCell className="text-right">
                      <div className="font-medium">
                        {formatCurrency(
                          account.balance || 0,
                          account.currency || "IDR",
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {account.currency || "IDR"}
                      </div>
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
