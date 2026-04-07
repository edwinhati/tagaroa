"use client";

import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { DataTableDeleteDialog } from "@repo/common/components/data-table-delete-dialog";
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
  exportLiabilitiesQueryOptions,
  liabilityQueryOptions,
  liabilityTypesQueryOptions,
  useLiabilityDeleteMutationOptions,
  useLiabilityMutationOptions,
} from "@repo/common/lib/query/liability-query";

import type {
  Liability,
  PaginatedLiabilitiesResult,
} from "@repo/common/types/liability";
import { getInstallmentProgress } from "@repo/common/types/liability";
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

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import {
  IconCircleCheck,
  IconDots,
  IconEye,
  IconEyeOff,
  IconPlus,
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

const InstallmentProgressCell = ({ row }: { row: Row<Liability> }) => {
  const liability = row.original;

  // Use the helper function to get installment progress
  const progress = getInstallmentProgress(liability);

  if (!progress) {
    return <span className="text-muted-foreground">-</span>;
  }

  const { paid, total, percentage } = progress;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {paid} of {total} months
        </span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
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

type LiabilityTableMeta = {
  mutateLiability: (liability: Liability) => void;
  deleteLiability: (id: string) => void;
};

const ActionsCell = ({
  row,
  table,
}: {
  row: Row<Liability>;
  table: ReturnType<typeof useReactTable<Liability>>;
}) => {
  const meta = table.options.meta as LiabilityTableMeta | undefined;
  return meta?.mutateLiability && meta?.deleteLiability ? (
    <RowActions
      row={row}
      mutateLiability={meta.mutateLiability}
      deleteLiability={meta.deleteLiability}
    />
  ) : null;
};

const multiColumnFilterFn: FilterFn<Liability> = (row, filterValue) => {
  const searchableRowContent =
    `${row.original.name} ${row.original.type}`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

const columns: ColumnDef<Liability>[] = [
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
    id: "installmentProgress",
    header: "Installment Progress",
    cell: InstallmentProgressCell,
    size: 150,
    enableSorting: false,
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
    cell: ActionsCell,
    size: 60,
    enableSorting: false,
  },
];

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

  const liabilityMutationOpts = useLiabilityMutationOptions();
  const { mutate: mutateLiability } = useMutation(liabilityMutationOpts);

  const liabilityDeleteMutationOpts = useLiabilityDeleteMutationOptions();
  const { mutate: deleteLiability } = useMutation({
    ...liabilityDeleteMutationOpts,
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
  const hasActiveFilters = searchQuery.length > 0 || typeFilter.length > 0;

  const typeFilterOptions = useMemo(
    () =>
      (liabilityTypes ?? []).map((type) => ({
        value: type,
        label: type.replaceAll("_", " "),
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
      mutateLiability,
      deleteLiability,
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
    return <DataTableSkeleton columnCount={columns.length} />;
  }

  return (
    <div className="relative space-y-4">
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setEditDialogOpen(true);
              }}
            >
              <span>Edit</span>
              <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
            </DropdownMenuItem>
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
      <LiabilityFormDialog
        initialData={row.original}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
}
