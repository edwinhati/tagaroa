"use client";

import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { DataTableExportButton } from "@repo/common/components/data-table-export-button";
import { DataTableMultiSelectFilter } from "@repo/common/components/data-table-multi-select-filter";
import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { ServerSearchInput } from "@repo/common/components/data-table-search-input";
import { Loading } from "@repo/common/components/loading";
import { exportToCSV } from "@repo/common/lib/csv-export";
import {
  accountDeleteMutationOptions,
  accountQueryOptions,
  exportAccountsQueryOptions,
} from "@repo/common/lib/query/account-query";
import type {
  Account,
  AccountCategory,
  PaginatedAccountsResult,
} from "@repo/common/types/account";
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
import {
  IconChevronDown,
  IconChevronUp,
  IconDots,
  IconPlus,
  IconWallet,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type PaginationState,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AccountFormDialog } from "@/components/account-form-dialog";

// Cell renderer components - defined outside to avoid recreation on each render
const SelectHeaderCell = ({
  table,
}: {
  table: ReturnType<typeof useReactTable<Account>>;
}) => (
  <Checkbox
    checked={table.getIsAllPageRowsSelected()}
    indeterminate={table.getIsSomePageRowsSelected()}
    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
    aria-label="Select all"
  />
);

const SelectRowCell = ({ row }: { row: Row<Account> }) => (
  <Checkbox
    checked={row.getIsSelected()}
    onCheckedChange={(value) => row.toggleSelected(!!value)}
    aria-label="Select row"
  />
);

const NameCell = ({ row }: { row: Row<Account> }) => (
  <div className="font-medium">{row.getValue("name")}</div>
);

const TypeCell = ({ row }: { row: Row<Account> }) => {
  const typeValue = row.getValue("type")?.toString().replaceAll("_", "-");
  return <Badge variant="outline">{typeValue}</Badge>;
};

const BalanceCell = ({ row }: { row: Row<Account> }) => {
  const amount = Number.parseFloat(row.getValue("balance"));
  const formatted = new Intl.NumberFormat(
    row.original.currency === "IDR" ? "id-ID" : "en-US",
    {
      style: "currency",
      currency: row.original.currency,
    },
  ).format(amount);
  return formatted;
};

const ActionsHeaderCell = () => <span className="sr-only">Actions</span>;

export function AccountDataTable() {
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

  return <AccountDataTableContent />;
}

// Custom filter function for multi-column searching
const multiColumnFilterFn: FilterFn<Account> = (
  row,
  _columnId,
  filterValue,
) => {
  const searchableRowContent =
    `${row.original.name} ${row.original.type}`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

function AccountDataTableContent() {
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get("category") as AccountCategory | null;

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });
  const [serverFilters, setServerFilters] = useState<Record<string, string[]>>(
    {},
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});

  // Stable data state to prevent re-renders during refetch
  const [stableData, setStableData] = useState<PaginatedAccountsResult | null>(
    null,
  );
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const { mutate: deleteAccount } = useMutation(accountDeleteMutationOptions());

  const queryClient = useQueryClient();

  const { data: accountsResponse, error } = useQuery(
    accountQueryOptions({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      filters: serverFilters,
      search: searchQuery,
      category: categoryFilter ?? undefined,
    }),
  );

  const columns: ColumnDef<Account>[] = useMemo(
    () => [
      {
        id: "select",
        header: SelectHeaderCell,
        cell: SelectRowCell,
        size: 28,
      },
      {
        header: "Name",
        accessorKey: "name",
        cell: NameCell,
        size: 180,
        filterFn: multiColumnFilterFn,
      },
      {
        header: "Notes",
        accessorKey: "notes",
        size: 220,
      },
      {
        header: "Type",
        accessorKey: "type",
        cell: TypeCell,
        size: 100,
      },
      {
        header: "Balance",
        accessorKey: "balance",
        cell: BalanceCell,
        size: 120,
      },
      {
        id: "actions",
        header: ActionsHeaderCell,
        cell: ({ row }) => (
          <RowActions row={row} deleteAccount={deleteAccount} />
        ),
        size: 60,
      },
    ],
    [deleteAccount],
  );

  // Update stable data only when new data arrives, not during loading
  useEffect(() => {
    if (accountsResponse && !error) {
      setStableData({
        accounts: accountsResponse.accounts || [],
        pagination: accountsResponse.pagination,
        aggregations: accountsResponse.aggregations || {},
      });
      setIsInitialLoading(false);
    }
  }, [accountsResponse, error]);

  // Use stable data to prevent re-renders during refetch
  const tableData = useMemo(
    () => stableData?.accounts ?? [],
    [stableData?.accounts],
  );

  const paginationInfo = stableData?.pagination;
  const aggregations = useMemo(
    () => stableData?.aggregations ?? {},
    [stableData?.aggregations],
  );
  const showLoadingState = isInitialLoading;
  const skeletonRowKeys = useMemo(
    () =>
      Array.from({ length: pagination.pageSize }, (_, index) => {
        return `accounts-loading-${pagination.pageIndex}-${index}`;
      }),
    [pagination.pageIndex, pagination.pageSize],
  );

  // Check if there are any active filters or search
  const hasActiveFilters =
    Object.keys(serverFilters).length > 0 || searchQuery.length > 0;

  // Check if there's truly no data (no accounts at all for the user)
  const hasTotalData = (paginationInfo?.total ?? 0) > 0;

  // Memoize filter options to prevent re-ordering and popover closing
  const filterOptions = useMemo(() => {
    const options: Record<
      string,
      Array<{ value: string; label: string; count: number }>
    > = {};

    // Sort aggregation keys for consistent order
    const sortedAggregationKeys = Object.keys(aggregations).sort((a, b) =>
      a.localeCompare(b),
    );

    for (const filterKey of sortedAggregationKeys) {
      const aggregationItems = aggregations[filterKey] || [];

      // Sort items by key for consistent order
      const sortedItems = [...aggregationItems].sort((a, b) =>
        a.key.localeCompare(b.key),
      );

      options[filterKey] = sortedItems.map((item) => ({
        value: item.key,
        label: item.key.replaceAll("_", "-"),
        count: item.count,
      }));
    }

    return options;
  }, [aggregations]);

  // TanStack Table exposes functions that React Compiler cannot memoize; suppress rule locally.
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: paginationInfo?.total_pages ?? 0,
    onPaginationChange: setPagination,
    state: {
      pagination,
    },
  });

  const handleDeleteRows = () => {
    const selectedRows = table.getSelectedRowModel().rows;

    for (const row of selectedRows) {
      deleteAccount(row.original.id as string);
    }

    table.resetRowSelection();
  };

  const hasRows = table.getRowModel().rows.length > 0;
  const selectedCount = table.getSelectedRowModel().rows.length;

  // Handle server-side filter changes
  const handleServerFilterChange = (
    filterKey: string,
    value: string,
    checked: boolean,
  ) => {
    // Keep the popover open during filter changes
    setOpenPopovers((prev) => ({ ...prev, [filterKey]: true }));

    setServerFilters((prev) => {
      const currentValues = prev[filterKey] || [];
      let newValues: string[];

      if (checked) {
        newValues = [...currentValues, value];
      } else {
        newValues = currentValues.filter((v) => v !== value);
      }

      const newFilters = { ...prev };
      if (newValues.length === 0) {
        delete newFilters[filterKey];
      } else {
        newFilters[filterKey] = newValues;
      }

      // Reset to first page when filters change
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));

      return newFilters;
    });
  };

  const handleServerFilterClear = (filterKey: string) => {
    setServerFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[filterKey];

      // Reset to first page when filters change
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));

      return newFilters;
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Reset to first page when search changes
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleExport = async () => {
    // Fetch all accounts for export using query client
    const exportData = await queryClient.fetchQuery(
      exportAccountsQueryOptions({
        filters: serverFilters,
        search: searchQuery,
        category: categoryFilter ?? undefined,
      }),
    );

    if (!exportData || exportData.length === 0) {
      return;
    }

    // Map accounts to CSV-friendly format
    const csvData = exportData.map((account) => ({
      Name: account.name,
      Type: account.type,
      Balance: account.balance,
      Currency: account.currency,
      Notes: account.notes ?? "",
    }));

    exportToCSV(csvData, {
      filename: "accounts",
    });
  };

  // Show error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-red-500">
          Error loading accounts: {error.message}
        </div>
      </div>
    );
  }

  // Show initial loading state only on first load
  if (isInitialLoading) {
    return <AccountTableSkeleton />;
  }

  return (
    <div className="relative space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ServerSearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search accounts..."
            className="min-w-60"
            aria-label="Search accounts"
          />
          {/* Dynamic filters based on aggregations */}
          {Object.entries(filterOptions).map(([filterKey, options]) => (
            <DataTableMultiSelectFilter
              key={filterKey}
              triggerLabel={
                filterKey.charAt(0).toUpperCase() + filterKey.slice(1)
              }
              options={options}
              selectedValues={serverFilters[filterKey] || []}
              onChange={(value, checked) =>
                handleServerFilterChange(filterKey, value, checked)
              }
              onClear={() => handleServerFilterClear(filterKey)}
              open={openPopovers[filterKey]}
              onOpenChange={(open) =>
                setOpenPopovers((prev) => ({ ...prev, [filterKey]: open }))
              }
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <DataTableBulkDeleteDialog
            buttonSize="sm"
            selectedCount={selectedCount}
            onConfirm={handleDeleteRows}
            description={`This action cannot be undone. This will permanently delete ${selectedCount} selected ${selectedCount === 1 ? "row" : "rows"}.`}
            buttonClassName="ml-auto"
          />
          <DataTableExportButton onClick={handleExport} />
          <AccountFormDialog />
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
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                          "flex h-8 select-none items-center justify-between gap-2 px-0 hover:bg-transparent focus-visible:ring-0",
                          "cursor-pointer",
                        )}
                        onClick={toggleSorting}
                      >
                        {headerLabel}
                        {sortState === "asc" && (
                          <IconChevronUp
                            className="shrink-0 opacity-60"
                            size={16}
                            aria-hidden="true"
                          />
                        )}
                        {sortState === "desc" && (
                          <IconChevronDown
                            className="shrink-0 opacity-60"
                            size={16}
                            aria-hidden="true"
                          />
                        )}
                      </Button>
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

              const renderEmptyState = !hasTotalData && !hasActiveFilters;
              return (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-96">
                    <div className="flex h-full">
                      {renderEmptyState ? (
                        <Empty>
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <IconWallet aria-hidden="true" />
                            </EmptyMedia>
                            <EmptyTitle>No Accounts Yet</EmptyTitle>
                            <EmptyDescription>
                              You haven&apos;t added any accounts yet. Get
                              started by adding your first account to track your
                              finances.
                            </EmptyDescription>
                          </EmptyHeader>
                          <EmptyContent>
                            <AccountFormDialog
                              trigger={
                                <Button size="sm">
                                  <IconPlus
                                    className="-ms-1 opacity-60"
                                    size={16}
                                    aria-hidden="true"
                                  />
                                  Add account
                                </Button>
                              }
                            />
                          </EmptyContent>
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

type RowActionsProps = Readonly<{
  row: Row<Account>;
  deleteAccount: (id: string) => void;
}>;

function RowActions({ row, deleteAccount }: RowActionsProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);

  return (
    <div className="flex justify-end">
      <AccountFormDialog
        initialData={row.original}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        trigger={null}
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
              deleteAccount(row.original.id as string);
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

function AccountTableSkeleton() {
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
              {[
                "name",
                "type",
                "currency",
                "balance",
                "created",
                "actions",
              ].map((col) => (
                <TableHead key={`header-${col}`}>
                  <Skeleton className="h-4 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, i) => `skeleton-${i}`).map((id) => (
              <TableRow key={id}>
                {[
                  "name",
                  "type",
                  "currency",
                  "balance",
                  "created",
                  "actions",
                ].map((col) => (
                  <TableCell key={`${id}-${col}`}>
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

const resolveColumnKey = (
  column: ColumnDef<Account>,
  fallbackIndex: number,
) => {
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
