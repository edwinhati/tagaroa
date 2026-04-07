"use client";

import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { DataTableEmptyState } from "@repo/common/components/data-table-empty-state";
import { DataTableMultiSelectFilter } from "@repo/common/components/data-table-multi-select-filter";
import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { ServerSearchInput } from "@repo/common/components/data-table-search-input";
import { DataTableSortableHeader } from "@repo/common/components/data-table-sortable-header";
import { Loading } from "@repo/common/components/loading";
import { useDebounce } from "@repo/common/hooks/use-debounce";
import { useFilters } from "@repo/common/hooks/use-filters";
import {
  transactionQueryOptions,
  useTransactionDeleteMutationOptions,
} from "@repo/common/lib/query/transaction-query";
import type { AggregationItem } from "@repo/common/types";
import type {
  PaginatedTransactionsResult,
  Transaction,
} from "@repo/common/types/transaction";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
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
import { IconDots, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type PaginationState,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { DateRangePicker } from "./date-range-picker";
import { TransactionFormDialog } from "./transaction-form-dialog";

// Types

type TransactionWithRelations = Transaction & {
  account?: {
    id: string;
    name: string;
    type: string;
    balance: number;
    currency: string;
  };
  budget_item?: {
    id: string;
    allocation: number;
    category: string;
  };
};

// Skeleton

function TransactionTableSkeleton() {
  const headerKeys = Array.from(
    { length: 9 },
    (_, i) => `transaction-header-${i}`,
  );
  const rowKeys = Array.from(
    { length: 5 },
    (_, i) => `transaction-skeleton-row-${i}`,
  );
  const cellKeys = Array.from(
    { length: 9 },
    (_, j) => `transaction-skeleton-cell-${j}`,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Skeleton className="h-8 w-[250px]" />
          <Skeleton className="h-8 w-[100px]" />
          <Skeleton className="h-8 w-[100px]" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-[100px]" />
          <Skeleton className="h-8 w-[120px]" />
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {headerKeys.map((headerKey) => (
                <TableHead key={headerKey}>
                  <Skeleton className="h-4 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowKeys.map((rowKey) => (
              <TableRow key={rowKey}>
                {cellKeys.map((cellKey) => (
                  <TableCell key={`${rowKey}-${cellKey}`}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TransactionTableSkeletonRows() {
  const skeletonRows = Array.from(
    { length: 5 },
    (_, i) => `transaction-skeleton-row-${i}`,
  );
  const skeletonCells = Array.from(
    { length: 9 },
    (_, j) => `transaction-skeleton-cell-${j}`,
  );

  return (
    <>
      {skeletonRows.map((rowKey) => (
        <TableRow key={rowKey} className="pointer-events-none">
          {skeletonCells.map((cellKey, j) => (
            <TableCell key={`${rowKey}-${cellKey}`}>
              <Skeleton
                className={j === 0 ? "h-4 w-4 rounded" : "h-5 w-full"}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// Row Actions

type RowActionsProps = Readonly<{
  row: Row<TransactionWithRelations>;
  deleteTransaction: (id: string) => void;
}>;

function RowActions({ row, deleteTransaction }: RowActionsProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);

  return (
    <div className="flex justify-end">
      <TransactionFormDialog
        initialData={row.original}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              className="shadow-none"
              aria-label="Edit item"
            >
              <IconDots size={16} aria-hidden="true" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setShowEditDialog(true)}>
              <span>Edit</span>
              <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              deleteTransaction(row.original.id as string);
            }}
            className="text-destructive focus:text-destructive"
          >
            <span>Delete</span>
            <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Columns

function buildColumns(
  deleteTransaction: (id: string) => void,
): ColumnDef<TransactionWithRelations>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      size: 28,
      enableSorting: false,
      enableHiding: false,
    },
    {
      header: "Date",
      accessorKey: "date",
      cell: ({ row }) => (
        <div className="font-medium">
          {format(row.getValue("date"), "MMM dd, yyyy")}
        </div>
      ),
      size: 120,
    },
    {
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => {
        const typeValue = row.getValue("type") as string;
        const isIncome = typeValue === "INCOME";
        return (
          <Badge
            variant="outline"
            className={cn(
              isIncome
                ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "border-rose-500/40 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
            )}
          >
            {typeValue.replaceAll("_", "-")}
          </Badge>
        );
      },
      size: 100,
    },
    {
      header: "Amount",
      accessorKey: "amount",
      cell: ({ row }) => {
        const amount = Number.parseFloat(row.getValue("amount"));
        const isIncome = row.original.type === "INCOME";
        const formatted = new Intl.NumberFormat(
          row.original.currency === "IDR" ? "id-ID" : "en-US",
          { style: "currency", currency: row.original.currency },
        ).format(amount);
        return (
          <span
            className={cn(
              "font-medium tabular-nums",
              isIncome
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {formatted}
          </span>
        );
      },
      size: 150,
    },
    {
      header: "Account",
      accessorFn: (row) => row.account?.name,
      cell: ({ row }) => (
        <div className="font-medium">{row.original.account?.name || "—"}</div>
      ),
      size: 150,
    },
    {
      header: "Category",
      accessorFn: (row) => row.budget_item?.category,
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {row.original.budget_item?.category || "—"}
        </div>
      ),
      size: 150,
    },
    {
      header: "Currency",
      accessorKey: "currency",
      cell: ({ row }) => (
        <Badge variant="outline">{row.getValue("currency")}</Badge>
      ),
      size: 100,
    },
    {
      header: "Notes",
      accessorKey: "notes",
      cell: ({ row }) => {
        const notes = row.getValue("notes");
        if (!notes) {
          return (
            <div className="max-w-[200px] truncate text-muted-foreground">
              —
            </div>
          );
        }
        const notesStr =
          typeof notes === "object" ? JSON.stringify(notes) : String(notes);
        return (
          <div className="max-w-[200px] truncate text-muted-foreground">
            {notesStr}
          </div>
        );
      },
      size: 220,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions row={row} deleteTransaction={deleteTransaction} />
      ),
      size: 60,
      enableHiding: false,
    },
  ];
}

// Toolbar

type ToolbarProps = Readonly<{
  searchQuery: string;
  onSearchChange: (value: string) => void;
  range: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
  aggregations: Record<string, AggregationItem[]>;
  serverFilters: Record<string, string[]>;
  openPopovers: Record<string, boolean>;
  onFilterChange: (filterKey: string, value: string, checked: boolean) => void;
  onFilterClear: (filterKey: string) => void;
  onOpenPopoverChange: (filterKey: string, open: boolean) => void;
  selectedCount: number;
  onBulkDelete: () => void;
}>;

function buildFilterOptions(
  aggregations: Record<string, AggregationItem[]>,
): Record<string, Array<{ value: string; label: string; count: number }>> {
  const options: Record<
    string,
    Array<{ value: string; label: string; count: number }>
  > = {};

  const sortedKeys = Object.keys(aggregations).sort((a, b) =>
    a.localeCompare(b),
  );

  for (const filterKey of sortedKeys) {
    const items = aggregations[filterKey] || [];
    const sortedItems = [...items].sort((a, b) => a.key.localeCompare(b.key));
    options[filterKey] = sortedItems.map((item) => ({
      value: item.id,
      label: item.key.replaceAll("_", "-"),
      count: item.count,
    }));
  }

  return options;
}

function TransactionToolbar({
  searchQuery,
  onSearchChange,
  range,
  onRangeChange,
  aggregations,
  serverFilters,
  openPopovers,
  onFilterChange,
  onFilterClear,
  onOpenPopoverChange,
  selectedCount,
  onBulkDelete,
}: ToolbarProps) {
  const filterOptions = buildFilterOptions(aggregations);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <ServerSearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search transactions..."
          className="min-w-60"
          aria-label="Search transactions"
        />
        <DateRangePicker date={range} onDateChange={onRangeChange} />
        {Object.entries(filterOptions).map(([filterKey, options]) => (
          <DataTableMultiSelectFilter
            key={filterKey}
            triggerLabel={
              filterKey.charAt(0).toUpperCase() + filterKey.slice(1)
            }
            options={options}
            selectedValues={serverFilters[filterKey] || []}
            onChange={(value, checked) =>
              onFilterChange(filterKey, value, checked)
            }
            onClear={() => onFilterClear(filterKey)}
            open={openPopovers[filterKey]}
            onOpenChange={(open) => onOpenPopoverChange(filterKey, open)}
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <DataTableBulkDeleteDialog
          buttonSize="sm"
          selectedCount={selectedCount}
          onConfirm={onBulkDelete}
          description={`This action cannot be undone. This will permanently delete ${selectedCount} selected ${selectedCount === 1 ? "row" : "rows"}.`}
          buttonClassName="ml-auto"
        />
        <TransactionFormDialog
          trigger={
            <Button size="sm">
              <IconPlus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          }
        />
      </div>
    </div>
  );
}

// Main component

export function TransactionDataTable() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loading />
      </div>
    );
  }

  return <TransactionDataTableContent />;
}

function TransactionDataTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [stableData, setStableData] =
    useState<PaginatedTransactionsResult | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const {
    serverFilters,
    setServerFilters,
    range,
    setRange,
    openPopovers,
    setOpenPopovers,
  } = useFilters((s) => ({
    serverFilters: s.serverFilters,
    setServerFilters: s.setServerFilters,
    range: s.range,
    setRange: s.setRange,
    openPopovers: s.openPopovers,
    setOpenPopovers: s.setOpenPopovers,
  }));

  // Initialize filters from URL query params (e.g. from budget page redirect)
  const searchParams = useSearchParams();
  useEffect(() => {
    const budgetItemId = searchParams.get("budget_item_id");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (budgetItemId) {
      setServerFilters({ budget_item_id: [budgetItemId] });
    }
    if (from || to) {
      setRange({
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });
    }
  }, [searchParams, setServerFilters, setRange]);

  const deleteMutationOpts = useTransactionDeleteMutationOptions();
  const { mutate: deleteTransaction } = useMutation(deleteMutationOpts);

  const { data: transactionsResponse, error } = useQuery(
    transactionQueryOptions({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      filters: serverFilters,
      search: debouncedSearchQuery,
      startDate: range?.from,
      endDate: range?.to,
    }),
  );

  const columns = useMemo(
    () => buildColumns(deleteTransaction),
    [deleteTransaction],
  );

  useEffect(() => {
    if (transactionsResponse && !error) {
      setStableData({
        transactions: transactionsResponse.transactions || [],
        pagination: transactionsResponse.pagination,
        aggregations: transactionsResponse.aggregations || {},
      });
      setIsInitialLoading(false);
      // If current page returns no rows but total > 0, reset to first page
      if (
        transactionsResponse.transactions?.length === 0 &&
        (transactionsResponse.pagination?.total ?? 0) > 0 &&
        pagination.pageIndex > 0
      ) {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      }
    }
  }, [transactionsResponse, error, pagination.pageIndex]);

  const tableData = useMemo(
    () => (stableData?.transactions ?? []) as TransactionWithRelations[],
    [stableData?.transactions],
  );

  const paginationInfo = stableData?.pagination;
  const aggregations = useMemo(
    () => stableData?.aggregations ?? {},
    [stableData?.aggregations],
  );

  const hasTotalData = (paginationInfo?.total ?? 0) > 0;
  const hasActiveFilters =
    Object.keys(serverFilters).length > 0 || searchQuery.length > 0;

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: paginationInfo?.total_pages ?? 0,
    onPaginationChange: setPagination,
    state: { pagination },
  });

  const handleBulkDelete = () => {
    for (const row of table.getSelectedRowModel().rows) {
      deleteTransaction(row.original.id as string);
    }
    table.resetRowSelection();
  };

  const handleFilterChange = (
    filterKey: string,
    value: string,
    checked: boolean,
  ) => {
    setOpenPopovers({ ...openPopovers, [filterKey]: true });
    const currentValues = serverFilters[filterKey] || [];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter((v) => v !== value);
    const newFilters = { ...serverFilters };
    if (newValues.length === 0) {
      delete newFilters[filterKey];
    } else {
      newFilters[filterKey] = newValues;
    }
    setServerFilters(newFilters);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleFilterClear = (filterKey: string) => {
    const newFilters = { ...serverFilters };
    delete newFilters[filterKey];
    setServerFilters(newFilters);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-red-500">
          Error loading transactions: {error.message}
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return <TransactionTableSkeleton />;
  }

  const hasRows = table.getRowModel().rows.length > 0;
  const selectedCount = table.getSelectedRowModel().rows.length;

  return (
    <div className="relative space-y-4">
      <h2 className="sr-only">Transaction Management</h2>
      <TransactionToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        range={range}
        onRangeChange={setRange}
        aggregations={aggregations}
        serverFilters={serverFilters}
        openPopovers={openPopovers}
        onFilterChange={handleFilterChange}
        onFilterClear={handleFilterClear}
        onOpenPopoverChange={(filterKey, open) =>
          setOpenPopovers({ ...openPopovers, [filterKey]: open })
        }
        selectedCount={selectedCount}
        onBulkDelete={handleBulkDelete}
      />

      <div className="bg-background overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <DataTableSortableHeader key={header.id} header={header} />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {(() => {
              if (isInitialLoading) return <TransactionTableSkeletonRows />;
              if (hasRows) {
                return table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="last:py-0">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ));
              }
              const renderEmptyState = !hasTotalData && !hasActiveFilters;
              return (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-96">
                    <div className="flex h-full">
                      {renderEmptyState ? (
                        <Empty>
                          <EmptyHeader>
                            <EmptyTitle>No Transactions Yet</EmptyTitle>
                            <EmptyDescription>
                              You haven&apos;t added any transactions yet. Get
                              started by adding your first transaction to track
                              your finances.
                            </EmptyDescription>
                          </EmptyHeader>
                          <EmptyContent>
                            <TransactionFormDialog
                              trigger={
                                <Button size="sm">
                                  <IconPlus
                                    className="-ms-1 opacity-60"
                                    size={16}
                                    aria-hidden="true"
                                  />
                                  Add transaction
                                </Button>
                              }
                            />
                          </EmptyContent>
                        </Empty>
                      ) : (
                        <DataTableEmptyState />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })()}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination
        table={table}
        pageSizeOptions={[5, 10, 25, 50]}
        serverSidePagination={
          paginationInfo
            ? {
                total: paginationInfo.total,
                page: paginationInfo.page,
                totalPages: paginationInfo.total_pages,
                hasNext: paginationInfo.has_next,
                hasPrev: paginationInfo.has_prev,
              }
            : undefined
        }
      />
    </div>
  );
}
