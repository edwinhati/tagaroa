"use client";

import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { DataTableEmptyState } from "@repo/common/components/data-table-empty-state";
import { DataTableExportButton } from "@repo/common/components/data-table-export-button";
import { DataTableMultiSelectFilter } from "@repo/common/components/data-table-multi-select-filter";
import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { ServerSearchInput } from "@repo/common/components/data-table-search-input";
import { DataTableSkeleton } from "@repo/common/components/data-table-skeleton";
import { DataTableSortableHeader } from "@repo/common/components/data-table-sortable-header";
import { Loading } from "@repo/common/components/loading";
import { exportToCSV } from "@repo/common/lib/csv-export";
import {
  accountQueryOptions,
  exportAccountsQueryOptions,
  useAccountDeleteMutationOptions,
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

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { IconDots, IconPlus, IconWallet } from "@tabler/icons-react";
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
}: Readonly<{
  table: ReturnType<typeof useReactTable<Account>>;
}>) => (
  <Checkbox
    checked={table.getIsAllPageRowsSelected()}
    indeterminate={table.getIsSomePageRowsSelected()}
    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
    aria-label="Select all"
  />
);

const SelectRowCell = ({ row }: Readonly<{ row: Row<Account> }>) => (
  <Checkbox
    checked={row.getIsSelected()}
    onCheckedChange={(value) => row.toggleSelected(!!value)}
    aria-label="Select row"
  />
);

const NameCell = ({ row }: Readonly<{ row: Row<Account> }>) => (
  <div className="font-medium">{row.getValue("name")}</div>
);

const TypeCell = ({ row }: Readonly<{ row: Row<Account> }>) => {
  const typeValue = row.getValue("type")?.toString().replaceAll("_", "-");
  return <Badge variant="outline">{typeValue}</Badge>;
};

const BalanceCell = ({ row }: Readonly<{ row: Row<Account> }>) => {
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
const multiColumnFilterFn: FilterFn<Account> = (row, filterValue) => {
  const searchableRowContent =
    `${row.original.name} ${row.original.type}`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

type AccountTableMeta = {
  deleteAccount: (id: string) => void;
};

const ActionsCell = ({
  row,
  table,
}: Readonly<{
  row: Row<Account>;
  table: ReturnType<typeof useReactTable<Account>>;
}>) => {
  const meta = table.options.meta as AccountTableMeta | undefined;
  return meta?.deleteAccount ? (
    <RowActions row={row} deleteAccount={meta.deleteAccount} />
  ) : null;
};

const columns: ColumnDef<Account>[] = [
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
    cell: ActionsCell,
    size: 60,
  },
];

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

  const accountDeleteMutationOpts = useAccountDeleteMutationOptions();
  const { mutate: deleteAccount } = useMutation(accountDeleteMutationOpts);

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
    meta: {
      deleteAccount,
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
    return <DataTableSkeleton columnCount={columns.length} />;
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
                {headerGroup.headers.map((header) => (
                  <DataTableSortableHeader key={header.id} header={header} />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {(() => {
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
