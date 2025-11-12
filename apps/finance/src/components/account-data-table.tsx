"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
  FilterFn,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  ColumnFiltersState,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  PaginationState,
} from "@tanstack/react-table";
import {
  PlusIcon,
  EllipsisIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/ui/components/empty";
import {
  useGetAccounts,
  useMutateAccount,
} from "@repo/common/lib/query/account-query";
import { Loading } from "@repo/common/components/loading";
import { AccountFormDialog } from "@/components/account-form-dialog";
import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { DataTableMultiSelectFilter } from "@repo/common/components/data-table-multi-select-filter";
import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { ServerSearchInput } from "@repo/common/components/data-table-search-input";
import { Account } from "@repo/common/types/account";

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

const columns: ColumnDef<Account>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
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
    header: "Name",
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
    size: 180,
    filterFn: multiColumnFilterFn,
    enableHiding: false,
    enableSorting: false,
  },
  {
    header: "Notes",
    accessorKey: "notes",
    size: 220,
    enableSorting: false,
  },
  {
    header: "Type",
    accessorKey: "type",
    cell: ({ row }) => {
      const typeValue = row.getValue("type")?.toString().replaceAll("_", "-");
      return <Badge variant="outline">{typeValue}</Badge>;
    },
    size: 100,
    enableSorting: false,
  },
  {
    header: "Balance",
    accessorKey: "balance",
    cell: ({ row }) => {
      const amount = Number.parseFloat(row.getValue("balance"));
      const formatted = new Intl.NumberFormat(
        row.original.currency === "IDR" ? "id-ID" : "en-US",
        {
          style: "currency",
          currency: row.original.currency,
        },
      ).format(amount);
      return formatted;
    },
    size: 120,
    enableSorting: false,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row} />,
    size: 60,
    enableHiding: false,
  },
];

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

function AccountDataTableContent() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
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
  const [stableData, setStableData] = useState<{
    accounts: Account[];
    pagination: any;
    aggregations: any;
  } | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [sorting, setSorting] = useState<SortingState>([]);

  const { mutate } = useMutateAccount({});
  const { data: accountsResponse, error } = useGetAccounts({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    filters: serverFilters,
    search: searchQuery,
  });

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
  const tableData = useMemo(() => {
    return stableData?.accounts || [];
  }, [stableData?.accounts]);

  const paginationInfo = stableData?.pagination;
  const aggregations = stableData?.aggregations || {};
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
  const hasTotalData = paginationInfo?.total > 0;

  const handleDeleteRows = () => {
    const selectedRows = table.getSelectedRowModel().rows;

    for (const row of selectedRows) {
      mutate({
        ...row.original,
        isDeleted: true,
      });
    }

    table.resetRowSelection();
  };

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

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    // Remove client-side pagination since we're using server-side
    manualPagination: true,
    pageCount: paginationInfo?.total_pages ?? 0,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
    },
  });

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
    return (
      <div className="flex justify-center items-center h-full">
        <Loading />
      </div>
    );
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
                      <TableHead key={header.id} style={widthStyle} className="h-11" />
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
                    const toggleSorting = header.column.getToggleSortingHandler();
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
                    <TableHead key={header.id} style={widthStyle} className="h-11">
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
                      const columnKey = String(
                        column.id ?? column.accessorKey ?? cellIndex,
                      );
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
                                  <PlusIcon
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

type RowActionsProps = Readonly<{ row: Row<Account> }>;

function RowActions({ row }: RowActionsProps) {
  const { mutate } = useMutateAccount({});
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex justify-end">
          <Button
            size="icon"
            variant="ghost"
            className="shadow-none"
            aria-label="Edit item"
          >
            <EllipsisIcon size={16} aria-hidden="true" />
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <AccountFormDialog
            initialData={row.original}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <span>Edit</span>
                <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
              </DropdownMenuItem>
            }
          />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              const a = row.original;
              mutate({
                name: `${a.name} (Copy)`,
                type: a.type,
                balance: a.balance,
                currency: a.currency,
                notes: a.notes,
              } as Account);
            }}
          >
            <span>Duplicate</span>
            <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            mutate({
              ...row.original,
              isDeleted: true,
            });
          }}
          className="text-destructive focus:text-destructive"
        >
          <span>Delete</span>
          <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
