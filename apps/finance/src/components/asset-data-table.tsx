"use client";

import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { DataTableDeleteDialog } from "@repo/common/components/data-table-delete-dialog";
import { DataTableEmptyState } from "@repo/common/components/data-table-empty-state";
import { DataTableExportButton } from "@repo/common/components/data-table-export-button";
import { DataTableMultiSelectFilter } from "@repo/common/components/data-table-multi-select-filter";
import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { ServerSearchInput } from "@repo/common/components/data-table-search-input";
import { DataTableSortableHeader } from "@repo/common/components/data-table-sortable-header";
import { Loading } from "@repo/common/components/loading";
import { exportToCSV } from "@repo/common/lib/csv-export";
import {
  assetQueryOptions,
  assetTypesQueryOptions,
  exportAssetsQueryOptions,
  useAssetDeleteMutationOptions,
  useAssetMutationOptions,
} from "@repo/common/lib/query/asset-query";
import { resolveColumnKey } from "@repo/common/lib/resolve-column-key";
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
import { IconDots, IconPlus, IconX } from "@tabler/icons-react";
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
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AssetFormDialog } from "@/components/asset-form-dialog";

const SelectHeaderCell = ({
  table,
}: {
  table: ReturnType<typeof useReactTable<Asset>>;
}) => (
  <Checkbox
    checked={table.getIsAllPageRowsSelected()}
    indeterminate={table.getIsSomePageRowsSelected()}
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

const ActionsCell = ({
  row,
  table,
}: {
  row: Row<Asset>;
  table: ReturnType<typeof useReactTable<Asset>>;
}) => {
  const meta = table.options.meta as
    | {
        mutateAsset: (asset: Asset) => void;
        deleteAsset: (id: string) => void;
      }
    | undefined;

  return (
    <RowActions
      row={row}
      mutateAsset={meta?.mutateAsset ?? (() => {})}
      deleteAsset={meta?.deleteAsset ?? (() => {})}
    />
  );
};

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

const multiColumnFilterFn: FilterFn<Asset> = (row, filterValue) => {
  const searchableRowContent =
    `${row.original.name} ${row.original.type} ${row.original.ticker || ""}`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

function AssetDataTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const [stableData, setStableData] = useState<PaginatedAssetsResult | null>(
    null,
  );
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const assetMutationOpts = useAssetMutationOptions();
  const { mutate: mutateAsset } = useMutation(assetMutationOpts);

  const assetDeleteMutationOpts = useAssetDeleteMutationOptions();
  const { mutate: deleteAsset } = useMutation({
    ...assetDeleteMutationOpts,
  });

  const queryClient = useQueryClient();

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
        cell: ActionsCell,
        size: 60,
      },
    ],
    [],
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
        label: type.replaceAll("_", " "),
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
    meta: {
      mutateAsset,
      deleteAsset,
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

  const handleExport = async () => {
    const exportData = await queryClient.fetchQuery(
      exportAssetsQueryOptions({
        search: searchQuery,
        filters: typeFilter.length > 0 ? { type: typeFilter } : undefined,
      }),
    );

    if (!exportData || exportData.length === 0) {
      return;
    }

    const csvData = exportData.map((asset) => ({
      Name: asset.name,
      Type: asset.type,
      Ticker: asset.ticker || "",
      Value: asset.value,
      Shares: asset.shares || "",
      Currency: asset.currency,
      Notes: asset.notes ?? "",
    }));

    exportToCSV(csvData, {
      filename: "assets",
    });
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

  let tableBodyContent: ReactNode;

  if (showLoadingState) {
    tableBodyContent = skeletonRowKeys.map((rowKey) => (
      <TableRow key={rowKey} className="pointer-events-none">
        {columns.map((column, cellIndex) => {
          const columnKey = resolveColumnKey(column, cellIndex);
          return (
            <TableCell key={`${columnKey}-${rowKey}`}>
              <Skeleton
                className={cellIndex === 0 ? "h-4 w-4 rounded" : "h-5 w-full"}
              />
            </TableCell>
          );
        })}
      </TableRow>
    ));
  } else if (hasRows) {
    tableBodyContent = table.getRowModel().rows.map((row) => (
      <TableRow
        key={row.id}
        data-state={row.getIsSelected() ? "selected" : undefined}
        className="transition-colors"
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id} className="last:py-0">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    ));
  } else if (!hasTotalData && !hasActiveFilters) {
    tableBodyContent = (
      <TableRow>
        <TableCell colSpan={columns.length} className="h-96">
          <div className="flex h-full">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No Assets Yet</EmptyTitle>
                <EmptyDescription>
                  You haven&apos;t added any assets yet. Get started by adding
                  your first asset to track your net worth.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <AssetFormDialog
                  trigger={
                    <Button size="sm">
                      <IconPlus
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
          </div>
        </TableCell>
      </TableRow>
    );
  } else {
    tableBodyContent = (
      <TableRow>
        <TableCell colSpan={columns.length} className="h-96">
          <div className="flex h-full">
            <div className="flex h-full w-full">
              <DataTableEmptyState />
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
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
          <AssetFormDialog
            trigger={
              <Button size="sm">
                <IconPlus className="-ms-1 opacity-60" size={16} />
                Add asset
              </Button>
            }
          />
        </div>
      </div>

      <div className="bg-background overflow-hidden rounded-md border">
        <Table className="table-fixed" role="table" aria-label="Assets table">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <DataTableSortableHeader key={header.id} header={header} />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>{tableBodyContent}</TableBody>
        </Table>
      </div>

      <DataTablePagination
        table={table}
        pageSizeOptions={[10, 25, 50, 100]}
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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <div className="flex justify-end">
      <AssetFormDialog
        initialData={row.original}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
      <DataTableDeleteDialog
        itemName={row.original.name}
        itemType="Asset"
        onConfirm={() => deleteAsset(row.original.id as string)}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
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
            <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
              <span>Edit</span>
              <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
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
            onClick={() => setShowDeleteDialog(true)}
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
