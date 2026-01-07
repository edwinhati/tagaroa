"use client";

import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { Loading } from "@repo/common/components/loading";
import { budgetHistoryQueryOptions } from "@repo/common/lib/query/budget-query";
import type { Budget, PaginatedBudgetsResult } from "@repo/common/types/budget";
import { Checkbox } from "@repo/ui/components/checkbox";
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
import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function BudgetHistoryDataTable() {
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

  return <BudgetHistoryDataTableContent />;
}

function BudgetHistoryDataTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });

  // Stable data state to prevent re-renders during refetch
  const [stableData, setStableData] = useState<PaginatedBudgetsResult | null>(
    null,
  );
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const { data: budgetResponse, error } = useQuery(
    budgetHistoryQueryOptions({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
    }),
  );

  const columns: ColumnDef<Budget>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
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
      },
      {
        id: "month",
        header: "Month",
        cell: ({ row }) => {
          const month = row.original.month;
          const year = new Date().getFullYear();
          const date = new Date(year, month - 1);

          return <span>{date.toLocaleString("en-US", { month: "long" })}</span>;
        },
      },
      {
        id: "year",
        header: "Year",
        cell: ({ row }) => {
          const year = row.original.year;

          return <span>{year}</span>;
        },
      },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }) => {
          const formatted = new Intl.NumberFormat(
            row.original.currency === "IDR" ? "id-ID" : "en-US",
            {
              style: "currency",
              currency: row.original.currency,
            },
          ).format(row.original.amount);
          return formatted;
        },
      },
      {
        id: "balance",
        header: "Balance",
        cell: ({ row }) => {
          const formatted = new Intl.NumberFormat(
            row.original.currency === "IDR" ? "id-ID" : "en-US",
            {
              style: "currency",
              currency: row.original.currency,
            },
          ).format(0);
          return formatted;
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        // cell: ({ row }) => <RowActions row={row} />,
        size: 60,
      },
    ],
    [],
  );

  // Update stable data only when new data arrives, not during loading
  useEffect(() => {
    if (budgetResponse && !error) {
      setStableData({
        budgets: budgetResponse.budgets || [],
        pagination: budgetResponse.pagination,
      });
      setIsInitialLoading(false);
    }
  }, [budgetResponse, error]);

  // Use stable data to prevent re-renders during refetch
  const tableData = useMemo(() => {
    return stableData?.budgets || [];
  }, [stableData?.budgets]);

  const paginationInfo = stableData?.pagination;
  const showLoadingState = isInitialLoading;
  const skeletonRowKeys = useMemo(
    () =>
      Array.from({ length: pagination.pageSize }, (_, index) => {
        return `budgets-loading-${pagination.pageIndex}-${index}`;
      }),
    [pagination.pageIndex, pagination.pageSize],
  );

  // Check if there's truly no data (no budgets at all for the user)
  const hasTotalData = (paginationInfo?.total ?? 0) > 0;

  // TanStack Table exposes functions that React Compiler cannot memoize; suppress rule locally.
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Remove client-side pagination since we're using server-side
    manualPagination: true,
    pageCount: paginationInfo?.total_pages ?? 0,
    onPaginationChange: setPagination,
    state: {
      pagination,
    },
  });

  const hasRows = table.getRowModel().rows.length > 0;
  const selectedCount = table.getSelectedRowModel().rows.length;

  const handleDeleteRows = () => {
    table.resetRowSelection();
  };

  // Show error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-red-500">
          Error loading budgets: {error.message}
        </div>
      </div>
    );
  }

  // Show initial loading state only on first load
  if (isInitialLoading) {
    return <BudgetHistoryTableSkeleton />;
  }

  return (
    <div className="relative space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <DataTableBulkDeleteDialog
            buttonSize="sm"
            selectedCount={selectedCount}
            onConfirm={handleDeleteRows}
            description={`This action cannot be undone. This will permanently delete ${selectedCount} selected ${selectedCount === 1 ? "row" : "rows"}.`}
            buttonClassName="ml-auto"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-background overflow-hidden rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const widthStyle = { width: `${header.getSize()}px` };

                  if (header.isPlaceholder) {
                    return (
                      <TableHead
                        key={header.id}
                        style={widthStyle}
                        className="h-11"
                      />
                    );
                  }

                  const canSort = header.column.getCanSort();
                  const sortState = header.column.getIsSorted();
                  const headerLabel = flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  );
                  let headerContent = headerLabel;

                  if (canSort) {
                    const toggleSorting =
                      header.column.getToggleSortingHandler();
                    headerContent = (
                      <button
                        type="button"
                        className={cn(
                          "flex h-full items-center justify-between gap-2 select-none",
                          "cursor-pointer",
                        )}
                        onClick={toggleSorting}
                      >
                        {headerLabel}
                        {sortState === "asc" && (
                          <ChevronUpIcon
                            className="shrink-0 opacity-60"
                            size={16}
                            aria-hidden="true"
                          />
                        )}
                        {sortState === "desc" && (
                          <ChevronDownIcon
                            className="shrink-0 opacity-60"
                            size={16}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  }

                  return (
                    <TableHead
                      key={header.id}
                      style={widthStyle}
                      className="h-11"
                    >
                      {headerContent}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {(() => {
              if (showLoadingState) {
                return skeletonRowKeys.map((rowKey) => (
                  <TableRow key={rowKey} className="pointer-events-none">
                    {columns.map((column, cellIndex) => {
                      const columnKey = resolveColumnKey(column, cellIndex);
                      return (
                        <TableCell key={`${columnKey}-${rowKey}`}>
                          <Skeleton
                            className={
                              cellIndex === 0 ? "h-4 w-4 rounded" : "h-5 w-full"
                            }
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ));
              }

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

              const renderEmptyState = !hasTotalData;
              return (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-96">
                    <div className="flex h-full">
                      {renderEmptyState ? (
                        <Empty>
                          <EmptyHeader>
                            <EmptyTitle>No Budgets Yet</EmptyTitle>
                            <EmptyDescription>
                              You haven&apos;t added any budgets yet. Get
                              started by adding your first budget to track your
                              finances.
                            </EmptyDescription>
                          </EmptyHeader>
                          <EmptyContent></EmptyContent>
                        </Empty>
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center text-center">
                          <div className="text-muted-foreground">
                            <h3 className="text-lg font-medium">
                              No results found
                            </h3>
                            <p className="mt-1 text-sm">
                              Try adjusting your search or filter criteria
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })()}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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

function BudgetHistoryTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Skeleton className="h-8 w-[100px]" />
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "period",
                "category",
                "budgeted",
                "spent",
                "remaining",
                "actions",
              ].map((col) => (
                <TableHead key={`header-${col}`}>
                  <Skeleton className="h-4 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, i) => `budget-skeleton-${i}`).map(
              (id) => (
                <TableRow key={id}>
                  {[
                    "period",
                    "category",
                    "budgeted",
                    "spent",
                    "remaining",
                    "actions",
                  ].map((col) => (
                    <TableCell key={`${id}-${col}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const resolveColumnKey = (column: ColumnDef<Budget>, fallbackIndex: number) => {
  if (column.id) {
    return column.id;
  }
  if ("accessorKey" in column) {
    const accessorKey = (column as { accessorKey?: string | number })
      .accessorKey;
    if (accessorKey !== undefined) {
      return accessorKey.toString();
    }
  }
  return `col-${fallbackIndex}`;
};
