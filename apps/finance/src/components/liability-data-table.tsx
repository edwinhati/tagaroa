"use client";

import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { DataTableDeleteDialog } from "@repo/common/components/data-table-delete-dialog";
import { DataTableExportButton } from "@repo/common/components/data-table-export-button";
import { DataTableMultiSelectFilter } from "@repo/common/components/data-table-multi-select-filter";
import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { ServerSearchInput } from "@repo/common/components/data-table-search-input";
import { Loading } from "@repo/common/components/loading";
import { exportToCSV } from "@repo/common/lib/csv-export";
import {
  exportLiabilitiesQueryOptions,
  liabilityDeleteMutationOptions,
  liabilityMutationOptions,
  liabilityQueryOptions,
  liabilityTypesQueryOptions,
} from "@repo/common/lib/query/liability-query";
import type {
  Liability,
  PaginatedLiabilitiesResult,
} from "@repo/common/types/liability";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
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
import {
  IconCashBanknote,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconDots,
  IconEye,
  IconEyeOff,
  IconListDetails,
  IconPlus,
  IconWallet,
  IconX,
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
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LiabilityFormDialog } from "@/components/liability-form-dialog";

const SelectHeaderCell = ({
  table,
}: {
  table: ReturnType<typeof useReactTable<Liability>>;
}) => (
  <Checkbox
    checked={table.getIsAllPageRowsSelected()}
    indeterminate={table.getIsSomePageRowsSelected()}
    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
    aria-label="Select all"
  />
);

const SelectRowCell = ({ row }: { row: Row<Liability> }) => (
  <Checkbox
    checked={row.getIsSelected()}
    onCheckedChange={(value) => row.toggleSelected(!!value)}
    aria-label="Select row"
  />
);

const NameCell = ({ row }: { row: Row<Liability> }) => (
  <div className="font-medium">{row.getValue("name")}</div>
);

const TypeCell = ({ row }: { row: Row<Liability> }) => {
  const typeValue = row.getValue("type")?.toString().replaceAll("_", " ");
  return <Badge variant="outline">{typeValue}</Badge>;
};

const AmountCell = ({ row }: { row: Row<Liability> }) => {
  const amount = Number.parseFloat(row.getValue("amount"));
  const formatted = new Intl.NumberFormat(
    row.original.currency === "IDR" ? "id-ID" : "en-US",
    {
      style: "currency",
      currency: row.original.currency,
    },
  ).format(amount);
  return formatted;
};

const StatusCell = ({ row }: { row: Row<Liability> }) => {
  if (row.original.paidAt) {
    return (
      <Badge variant="outline" className="text-green-600">
        <IconCircleCheck className="mr-1 h-3 w-3" />
        Paid
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-yellow-600">
      Unpaid
    </Badge>
  );
};

const ActionsHeaderCell = () => <span className="sr-only">Actions</span>;

export function LiabilityDataTable() {
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

  return <LiabilityDataTableContent />;
}

const multiColumnFilterFn: FilterFn<Liability> = (
  row,
  _columnId,
  filterValue,
) => {
  const searchableRowContent =
    `${row.original.name} ${row.original.type}`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

function LiabilityDataTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [showPaid, setShowPaid] = useState(false);

  const [stableData, setStableData] =
    useState<PaginatedLiabilitiesResult | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const { mutate: mutateLiability } = useMutation(liabilityMutationOptions());

  const { mutate: deleteLiability } = useMutation({
    ...liabilityDeleteMutationOptions(),
    onSuccess: () => toast.success("Liability deleted"),
    onError: (err) =>
      toast.error("Failed to delete", { description: err.message }),
  });

  const { data: liabilitiesResponse, error } = useQuery(
    liabilityQueryOptions({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      search: searchQuery,
      filters: typeFilter.length > 0 ? { type: typeFilter } : undefined,
      includePaid: showPaid,
    }),
  );

  const { data: liabilityTypes } = useQuery(liabilityTypesQueryOptions());

  const queryClient = useQueryClient();

  const columns: ColumnDef<Liability>[] = useMemo(
    () => [
      {
        id: "select",
        header: SelectHeaderCell,
        cell: SelectRowCell,
        size: 28,
        enableSorting: false,
      },
      {
        header: "Name",
        accessorKey: "name",
        cell: NameCell,
        size: 180,
        filterFn: multiColumnFilterFn,
      },
      {
        header: "Type",
        accessorKey: "type",
        cell: TypeCell,
        size: 100,
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: AmountCell,
        size: 120,
      },
      {
        id: "status",
        header: "Status",
        cell: StatusCell,
        size: 100,
        enableSorting: false,
      },
      {
        id: "actions",
        header: ActionsHeaderCell,
        cell: ({ row }) => (
          <RowActions
            row={row}
            mutateLiability={mutateLiability}
            deleteLiability={deleteLiability}
          />
        ),
        size: 60,
        enableSorting: false,
      },
    ],
    [deleteLiability, mutateLiability],
  );

  useEffect(() => {
    if (liabilitiesResponse && !error) {
      setStableData({
        liabilities: liabilitiesResponse.liabilities || [],
        pagination: liabilitiesResponse.pagination,
      });
      setIsInitialLoading(false);
    }
  }, [liabilitiesResponse, error]);

  const tableData = useMemo(
    () => stableData?.liabilities ?? [],
    [stableData?.liabilities],
  );

  const paginationInfo = stableData?.pagination;
  const showLoadingState = isInitialLoading;
  const skeletonRowKeys = useMemo(
    () =>
      Array.from({ length: pagination.pageSize }, (_, index) => {
        return `liabilities-loading-${pagination.pageIndex}-${index}`;
      }),
    [pagination.pageIndex, pagination.pageSize],
  );

  const hasActiveFilters = searchQuery.length > 0 || typeFilter.length > 0;

  const typeFilterOptions = useMemo(
    () =>
      (liabilityTypes ?? []).map((type) => ({
        value: type,
        label: type.replace(/_/g, " "),
      })),
    [liabilityTypes],
  );

  const handleTypeFilterChange = (value: string, checked: boolean) => {
    setTypeFilter((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value),
    );
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleTypeFilterClear = () => {
    setTypeFilter([]);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const hasTotalData = (paginationInfo?.total ?? 0) > 0;

  const summaryStats = useMemo(() => {
    const liabilities = stableData?.liabilities ?? [];
    const byCurrency: Record<
      string,
      { total: number; paid: number; unpaid: number }
    > = {};
    let paidCount = 0;
    let unpaidCount = 0;

    for (const l of liabilities) {
      const curr = byCurrency[l.currency] ?? { total: 0, paid: 0, unpaid: 0 };
      byCurrency[l.currency] = curr;
      curr.total += l.amount;
      if (l.paidAt) {
        curr.paid += l.amount;
        paidCount++;
      } else {
        curr.unpaid += l.amount;
        unpaidCount++;
      }
    }

    return { byCurrency, paidCount, unpaidCount };
  }, [stableData?.liabilities]);

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
      deleteLiability(row.original.id as string);
    }

    table.resetRowSelection();
  };

  const hasRows = table.getRowModel().rows.length > 0;
  const selectedCount = table.getSelectedRowModel().rows.length;

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleExport = async () => {
    const exportData = await queryClient.fetchQuery(
      exportLiabilitiesQueryOptions({
        filters: typeFilter.length > 0 ? { type: typeFilter } : undefined,
        search: searchQuery,
      }),
    );

    if (!exportData || exportData.length === 0) {
      return;
    }

    const csvData = exportData.map((liability) => ({
      Name: liability.name,
      Type: liability.type,
      Amount: liability.amount,
      Currency: liability.currency,
      Status: liability.paidAt ? "Paid" : "Unpaid",
      "Paid Date": liability.paidAt
        ? format(new Date(liability.paidAt), "yyyy-MM-dd")
        : "",
      Notes: liability.notes ?? "",
    }));

    exportToCSV(csvData, {
      filename: "liabilities",
    });
  };

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-red-500">
          Error loading liabilities: {error.message}
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return <LiabilityTableSkeleton />;
  }

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
      style: "currency",
      currency,
    }).format(amount);

  return (
    <div className="relative space-y-4">
      {hasTotalData && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="py-4">
            <CardContent className="flex items-center gap-4 py-0">
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
                <IconCashBanknote className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Debt</p>
                <p className="text-lg font-semibold">
                  {Object.entries(summaryStats.byCurrency).map(
                    ([cur, vals]) => (
                      <span key={cur} className="block text-sm">
                        {formatCurrency(vals.total, cur)}
                      </span>
                    ),
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-4 py-0">
              <div className="rounded-full bg-yellow-100 p-2 dark:bg-yellow-900">
                <IconWallet className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unpaid</p>
                <p className="text-lg font-semibold">
                  {Object.entries(summaryStats.byCurrency).map(
                    ([cur, vals]) => (
                      <span key={cur} className="block text-sm">
                        {formatCurrency(vals.unpaid, cur)}
                      </span>
                    ),
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-4 py-0">
              <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
                <IconCircleCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-lg font-semibold">
                  {Object.entries(summaryStats.byCurrency).map(
                    ([cur, vals]) => (
                      <span key={cur} className="block text-sm">
                        {formatCurrency(vals.paid, cur)}
                      </span>
                    ),
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-4 py-0">
              <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
                <IconListDetails className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Items</p>
                <p className="text-lg font-semibold">
                  {summaryStats.paidCount + summaryStats.unpaidCount} total
                  <span className="block text-sm font-normal text-muted-foreground">
                    {summaryStats.paidCount} paid, {summaryStats.unpaidCount}{" "}
                    unpaid
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ServerSearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search liabilities..."
            className="min-w-60"
            aria-label="Search liabilities"
          />
          <DataTableMultiSelectFilter
            triggerLabel="Type"
            options={typeFilterOptions}
            selectedValues={typeFilter}
            onChange={handleTypeFilterChange}
            onClear={handleTypeFilterClear}
          />
          <Button
            variant={showPaid ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowPaid((v) => !v)}
            className={showPaid ? "" : "text-muted-foreground"}
          >
            {showPaid ? (
              <IconEye size={14} className="mr-1" />
            ) : (
              <IconEyeOff size={14} className="mr-1" />
            )}
            {showPaid ? "Hiding paid" : "Show paid"}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                handleTypeFilterClear();
              }}
              className="text-muted-foreground"
            >
              <IconX size={14} className="mr-1" />
              Clear filters
            </Button>
          )}
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
          <LiabilityFormDialog
            trigger={
              <Button size="sm">
                <IconPlus className="-ms-1 opacity-60" size={16} />
                Add liability
              </Button>
            }
          />
        </div>
      </div>

      <div className="bg-background overflow-hidden rounded-md border">
        <Table
          className="table-fixed"
          role="table"
          aria-label="Liabilities table"
        >
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
                        className={cn(
                          "flex h-full items-center justify-between gap-2 select-none",
                          "cursor-pointer",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm",
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
                      aria-sort={
                        canSort
                          ? sortState === "asc"
                            ? "ascending"
                            : sortState === "desc"
                              ? "descending"
                              : "none"
                          : undefined
                      }
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
                    className="transition-colors"
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
                            <EmptyTitle>No Liabilities Yet</EmptyTitle>
                            <EmptyDescription>
                              You haven&apos;t added any liabilities yet. Get
                              started by adding your first liability to track
                              your net worth.
                            </EmptyDescription>
                          </EmptyHeader>
                          <EmptyContent>
                            <LiabilityFormDialog
                              trigger={
                                <Button size="sm">
                                  <IconPlus
                                    className="-ms-1 opacity-60"
                                    size={16}
                                    aria-hidden="true"
                                  />
                                  Add liability
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
  row: Row<Liability>;
  mutateLiability: (liability: Liability) => void;
  deleteLiability: (id: string) => void;
}>;

function RowActions({
  row,
  mutateLiability,
  deleteLiability,
}: RowActionsProps) {
  const handleMarkAsPaid = () => {
    mutateLiability({
      ...row.original,
      paidAt: new Date().toISOString(),
    });
    toast.success("Liability marked as paid");
  };

  const handleDuplicate = () => {
    const l = row.original;
    mutateLiability({
      name: `${l.name} (Copy)`,
      type: l.type,
      amount: l.amount,
      currency: l.currency,
      notes: l.notes,
      paidAt: null,
    } as Liability);
    toast.success("Liability duplicated");
  };

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              className="shadow-none"
              aria-label={`Actions for ${row.original.name}`}
            >
              <IconDots size={16} aria-hidden="true" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <LiabilityFormDialog
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
                handleDuplicate();
              }}
            >
              <span>Duplicate</span>
              <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
            {!row.original.paidAt && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  handleMarkAsPaid();
                }}
              >
                <span>Mark as Paid</span>
                <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DataTableDeleteDialog
            itemName={row.original.name}
            itemType="Liability"
            onConfirm={() => deleteLiability(row.original.id as string)}
            trigger={
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive focus:text-destructive"
              >
                <span>Delete</span>
                <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function LiabilityTableSkeleton() {
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
              {["select", "name", "type", "amount", "status", "actions"].map(
                (col) => (
                  <TableHead key={`header-${col}`}>
                    <Skeleton className="h-4 w-full" />
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, i) => `skeleton-${i}`).map((id) => (
              <TableRow key={id}>
                {["select", "name", "type", "amount", "status", "actions"].map(
                  (col) => (
                    <TableCell key={`${id}-${col}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ),
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const resolveColumnKey = (
  column: ColumnDef<Liability>,
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
