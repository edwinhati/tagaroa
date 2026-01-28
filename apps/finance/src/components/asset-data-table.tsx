"use client";

import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { DataTableMultiSelectFilter } from "@repo/common/components/data-table-multi-select-filter";
import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { ServerSearchInput } from "@repo/common/components/data-table-search-input";
import { Loading } from "@repo/common/components/loading";
import {
  assetDeleteMutationOptions,
  assetMutationOptions,
  assetQueryOptions,
  assetTypesQueryOptions,
} from "@repo/common/lib/query/asset-query";
import type { Asset, PaginatedAssetsResult } from "@repo/common/types/asset";
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
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EllipsisIcon,
  PlusIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AssetFormDialog } from "@/components/asset-form-dialog";

const SelectHeaderCell = ({
  table,
}: {
  table: ReturnType<typeof useReactTable<Asset>>;
}) => (
  <Checkbox
    checked={
      table.getIsAllPageRowsSelected() ||
      (table.getIsSomePageRowsSelected() && "indeterminate")
    }
    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
    aria-label="Select all"
  />
);

const SelectRowCell = ({ row }: { row: Row<Asset> }) => (
  <Checkbox
    checked={row.getIsSelected()}
    onCheckedChange={(value) => row.toggleSelected(!!value)}
    aria-label="Select row"
  />
);

const NameCell = ({ row }: { row: Row<Asset> }) => (
  <div className="font-medium">{row.getValue("name")}</div>
);

const TypeCell = ({ row }: { row: Row<Asset> }) => {
  const typeValue = row.getValue("type")?.toString().replaceAll("_", "-");
  return <Badge variant="outline">{typeValue}</Badge>;
};

const ValueCell = ({ row }: { row: Row<Asset> }) => {
  const amount = Number.parseFloat(row.getValue("value"));
  const formatted = new Intl.NumberFormat(
    row.original.currency === "IDR" ? "id-ID" : "en-US",
    {
      style: "currency",
      currency: row.original.currency,
    },
  ).format(amount);
  return formatted;
};

const TickerCell = ({ row }: { row: Row<Asset> }) => {
  const ticker = row.getValue("ticker") as string | null | undefined;
  return ticker ? <span className="font-mono">{ticker}</span> : <span>-</span>;
};

const ActionsHeaderCell = () => <span className="sr-only">Actions</span>;

export function AssetDataTable() {
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

  return <AssetDataTableContent />;
}

const multiColumnFilterFn: FilterFn<Asset> = (row, _columnId, filterValue) => {
  const searchableRowContent =
    `${row.original.name} ${row.original.type} ${row.original.ticker || ""}`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

function AssetDataTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const [stableData, setStableData] = useState<PaginatedAssetsResult | null>(
    null,
  );
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const { mutate: mutateAsset } = useMutation(assetMutationOptions());

  const { mutate: deleteAsset } = useMutation(assetDeleteMutationOptions());

  const { data: assetsResponse, error } = useQuery(
    assetQueryOptions({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      search: searchQuery,
      filters: typeFilter.length > 0 ? { type: typeFilter } : undefined,
    }),
  );

  const { data: assetTypes } = useQuery(assetTypesQueryOptions());

  const columns: ColumnDef<Asset>[] = useMemo(
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
        header: "Type",
        accessorKey: "type",
        cell: TypeCell,
        size: 100,
      },
      {
        header: "Ticker",
        accessorKey: "ticker",
        cell: TickerCell,
        size: 80,
      },
      {
        header: "Value",
        accessorKey: "value",
        cell: ValueCell,
        size: 120,
      },
      {
        id: "actions",
        header: ActionsHeaderCell,
        cell: ({ row }) => (
          <RowActions
            row={row}
            mutateAsset={mutateAsset}
            deleteAsset={deleteAsset}
          />
        ),
        size: 60,
      },
    ],
    [deleteAsset, mutateAsset],
  );

  useEffect(() => {
    if (assetsResponse && !error) {
      setStableData({
        assets: assetsResponse.assets || [],
        pagination: assetsResponse.pagination,
      });
      setIsInitialLoading(false);
    }
  }, [assetsResponse, error]);

  const tableData = useMemo(
    () => stableData?.assets ?? [],
    [stableData?.assets],
  );

  const paginationInfo = stableData?.pagination;
  const showLoadingState = isInitialLoading;
  const skeletonRowKeys = useMemo(
    () =>
      Array.from({ length: pagination.pageSize }, (_, index) => {
        return `assets-loading-${pagination.pageIndex}-${index}`;
      }),
    [pagination.pageIndex, pagination.pageSize],
  );

  const hasActiveFilters = searchQuery.length > 0 || typeFilter.length > 0;

  const typeFilterOptions = useMemo(
    () =>
      (assetTypes ?? []).map((type) => ({
        value: type,
        label: type.replace(/_/g, " "),
      })),
    [assetTypes],
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
      deleteAsset(row.original.id as string);
    }

    table.resetRowSelection();
  };

  const hasRows = table.getRowModel().rows.length > 0;
  const selectedCount = table.getSelectedRowModel().rows.length;

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-red-500">
          Error loading assets: {error.message}
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return <AssetTableSkeleton />;
  }

  return (
    <div className="relative space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ServerSearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search assets..."
            className="min-w-60"
            aria-label="Search assets"
          />
          <DataTableMultiSelectFilter
            triggerLabel="Type"
            options={typeFilterOptions}
            selectedValues={typeFilter}
            onChange={handleTypeFilterChange}
            onClear={handleTypeFilterClear}
          />
        </div>
        <div className="flex items-center gap-3">
          <DataTableBulkDeleteDialog
            buttonSize="sm"
            selectedCount={selectedCount}
            onConfirm={handleDeleteRows}
            description={`This action cannot be undone. This will permanently delete ${selectedCount} selected ${selectedCount === 1 ? "row" : "rows"}.`}
            buttonClassName="ml-auto"
          />
          <AssetFormDialog
            trigger={
              <Button size="sm">
                <PlusIcon className="-ms-1 opacity-60" size={16} />
                Add asset
              </Button>
            }
          />
        </div>
      </div>

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

              const renderEmptyState = !hasTotalData && !hasActiveFilters;
              return (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-96">
                    <div className="flex h-full">
                      {renderEmptyState ? (
                        <Empty>
                          <EmptyHeader>
                            <EmptyTitle>No Assets Yet</EmptyTitle>
                            <EmptyDescription>
                              You haven&apos;t added any assets yet. Get started
                              by adding your first asset to track your net
                              worth.
                            </EmptyDescription>
                          </EmptyHeader>
                          <EmptyContent>
                            <AssetFormDialog
                              trigger={
                                <Button size="sm">
                                  <PlusIcon
                                    className="-ms-1 opacity-60"
                                    size={16}
                                    aria-hidden="true"
                                  />
                                  Add asset
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
  row: Row<Asset>;
  mutateAsset: (asset: Asset) => void;
  deleteAsset: (id: string) => void;
}>;

function RowActions({ row, mutateAsset, deleteAsset }: RowActionsProps) {
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
          <AssetFormDialog
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
              mutateAsset({
                name: `${a.name} (Copy)`,
                type: a.type,
                value: a.value,
                shares: a.shares,
                ticker: a.ticker,
                currency: a.currency,
                notes: a.notes,
              } as Asset);
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
            deleteAsset(row.original.id as string);
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

function AssetTableSkeleton() {
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
              {["name", "type", "ticker", "value", "actions"].map((col) => (
                <TableHead key={`header-${col}`}>
                  <Skeleton className="h-4 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, i) => `skeleton-${i}`).map((id) => (
              <TableRow key={id}>
                {["name", "type", "ticker", "value", "actions"].map((col) => (
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

const resolveColumnKey = (column: ColumnDef<Asset>, fallbackIndex: number) => {
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
