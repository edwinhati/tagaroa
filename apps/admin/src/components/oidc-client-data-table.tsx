"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  flexRender,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EllipsisIcon,
  LoaderIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { DataTableSearchInput } from "@repo/common/components/data-table-search-input";
import { DataTableMultiSelectFilter } from "@repo/common/components/data-table-multi-select-filter";
import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { toast } from "sonner";

import { CopyToClipboard } from "@repo/common/components/copy-to-clipboard";
import { OIDCClientDetailSheet } from "@/components/oidc-client-detail-sheet";
import { CreateOIDCClientDialog } from "@/components/create-oidc-client-dialog";

// OIDC Client type based on Better Auth schema
interface OIDCClient {
  id: string;
  name: string;
  clientId: string;
  clientSecret?: string;
  redirectURLs: string[];
  type: "web" | "native" | "user-agent-based" | "public";
  disabled: boolean;
  icon?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Custom filter function for multi-column searching
const multiColumnFilterFn: FilterFn<OIDCClient> = (
  row,
  _columnId,
  filterValue
) => {
  const searchableRowContent =
    `${row.original.name} ${row.original.clientId}`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

const typeFilterFn: FilterFn<OIDCClient> = (
  row,
  _columnId,
  filterValue: string[]
) => {
  if (!filterValue?.length) return true;
  const type = row.getValue("type") as string;
  return filterValue.includes(type);
};

const statusFilterFn: FilterFn<OIDCClient> = (
  row,
  _columnId,
  filterValue: string[]
) => {
  if (!filterValue?.length) return true;
  const disabled = row.original.disabled;
  const status = disabled ? "disabled" : "active";
  return filterValue.includes(status);
};

export function OIDCClientDataTable() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    clientSecret: false,
    metadata: false,
  });
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "name",
      desc: false,
    },
  ]);

  const [clients, setClients] = useState<OIDCClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Fetch OIDC clients - we'll need to implement this endpoint
  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get clients from localStorage (since Better Auth doesn't provide a list endpoint)
      const storedClients = localStorage.getItem("oidc-clients");
      const parsedClients = storedClients ? JSON.parse(storedClients) : [];

      // Convert date strings back to Date objects
      const clients = parsedClients.map(
        (client: OIDCClient & { createdAt: string; updatedAt: string }) => ({
          ...client,
          createdAt: new Date(client.createdAt),
          updatedAt: new Date(client.updatedAt),
        })
      );

      setClients(clients);
    } catch {
      setError("Failed to fetch OIDC clients. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const toggleSecretVisibility = (clientId: string) => {
    setShowSecrets((prev) => ({
      ...prev,
      [clientId]: !prev[clientId],
    }));
  };

  const columns: ColumnDef<OIDCClient>[] = useMemo(
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
        enableHiding: false,
      },
      {
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="font-medium">{row.getValue("name")}</div>
        ),
        size: 200,
        filterFn: multiColumnFilterFn,
        enableHiding: false,
      },
      {
        header: "Client ID",
        accessorKey: "clientId",
        cell: ({ row }) => {
          const clientId = row.getValue("clientId") as string;
          return (
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {clientId}
              </code>
              <CopyToClipboard text={clientId} label="Client ID" />
            </div>
          );
        },
        size: 250,
      },
      {
        header: "Client Secret",
        accessorKey: "clientSecret",
        cell: ({ row }) => {
          const client = row.original;
          const clientSecret = client.clientSecret;
          const isVisible = showSecrets[client.clientId];

          if (!clientSecret) {
            return <span className="text-muted-foreground">—</span>;
          }

          return (
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {isVisible ? clientSecret : "••••••••••••••••"}
              </code>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => toggleSecretVisibility(client.clientId)}
              >
                {isVisible ? (
                  <EyeOffIcon className="h-3 w-3" />
                ) : (
                  <EyeIcon className="h-3 w-3" />
                )}
              </Button>
              {isVisible && (
                <CopyToClipboard text={clientSecret} label="Client Secret" />
              )}
            </div>
          );
        },
        size: 250,
      },
      {
        header: "Type",
        accessorKey: "type",
        cell: ({ row }) => {
          const type = row.getValue("type") as string;
          const typeLabels = {
            web: "Web Application",
            native: "Native App",
            "user-agent-based": "SPA",
            public: "Public Client",
          };

          return (
            <Badge variant="secondary" className="capitalize">
              {typeLabels[type as keyof typeof typeLabels] || type}
            </Badge>
          );
        },
        size: 120,
        filterFn: typeFilterFn,
      },
      {
        header: "Status",
        accessorKey: "disabled",
        cell: ({ row }) => {
          const disabled = row.getValue("disabled") as boolean;
          return (
            <Badge variant={disabled ? "destructive" : "default"}>
              {disabled ? "Disabled" : "Active"}
            </Badge>
          );
        },
        size: 100,
        filterFn: statusFilterFn,
      },
      {
        header: "Redirect URLs",
        accessorKey: "redirectURLs",
        cell: ({ row }) => {
          const redirectURLs = row.getValue("redirectURLs") as string[];
          const displayUrl = redirectURLs[0];
          const hasMore = redirectURLs.length > 1;

          return (
            <div className="max-w-[200px]">
              <div className="truncate text-sm" title={displayUrl}>
                {displayUrl}
              </div>
              {hasMore && (
                <div className="text-xs text-muted-foreground">
                  +{redirectURLs.length - 1} more
                </div>
              )}
            </div>
          );
        },
        size: 200,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => <RowActions row={row} onRefresh={fetchClients} />,
        size: 60,
        enableHiding: false,
      },
    ],
    [showSecrets, fetchClients]
  );

  const handleDeleteRows = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedClientIds = selectedRows.map((row) => row.original.id);

    if (selectedClientIds.length === 0) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Delete from localStorage
      const existingClients = JSON.parse(
        localStorage.getItem("oidc-clients") || "[]"
      );
      const updatedClients = existingClients.filter(
        (client: OIDCClient) => !selectedClientIds.includes(client.id)
      );
      localStorage.setItem("oidc-clients", JSON.stringify(updatedClients));

      // Refresh the client list after successful deletion
      await fetchClients();

      // Reset row selection
      table.resetRowSelection();

      toast.success(
        `Successfully deleted ${selectedClientIds.length} client${selectedClientIds.length === 1 ? "" : "s"}.`
      );
    } catch (error) {
      console.error("Failed to delete clients:", error);
      setError(
        `Failed to delete ${selectedClientIds.length} selected client${selectedClientIds.length === 1 ? "" : "s"}. Please try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  const tableData = useMemo(() => {
    return clients;
  }, [clients]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
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

  // Get unique type values
  const typeColumn = table.getColumn("type");
  const uniqueTypeValues = typeColumn
    ? Array.from(typeColumn.getFacetedUniqueValues().keys()).sort()
    : [];
  const typeCounts = typeColumn
    ? typeColumn.getFacetedUniqueValues()
    : new Map();
  const selectedTypes =
    (table.getColumn("type")?.getFilterValue() as string[]) ?? [];

  // Get unique status values
  const statusColumn = table.getColumn("disabled");
  const statusCounts = statusColumn
    ? statusColumn.getFacetedUniqueValues()
    : new Map();
  const selectedStatuses =
    (table.getColumn("disabled")?.getFilterValue() as string[]) ?? [];

  const selectedCount = table.getSelectedRowModel().rows.length;

  const handleTypesChange = (value: string, checked: boolean) => {
    const filterValue = table.getColumn("type")?.getFilterValue() as string[];
    const newFilterValue = filterValue ? [...filterValue] : [];

    if (checked) {
      newFilterValue.push(value);
    } else {
      const index = newFilterValue.indexOf(value);
      if (index > -1) {
        newFilterValue.splice(index, 1);
      }
    }

    table
      .getColumn("type")
      ?.setFilterValue(newFilterValue.length ? newFilterValue : undefined);
  };

  const handleStatusChange = (value: string, checked: boolean) => {
    const filterValue = table
      .getColumn("disabled")
      ?.getFilterValue() as string[];
    const newFilterValue = filterValue ? [...filterValue] : [];

    if (checked) {
      newFilterValue.push(value);
    } else {
      const index = newFilterValue.indexOf(value);
      if (index > -1) {
        newFilterValue.splice(index, 1);
      }
    }

    table
      .getColumn("disabled")
      ?.setFilterValue(newFilterValue.length ? newFilterValue : undefined);
  };

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <DataTableSearchInput
            table={table}
            columnId="name"
            placeholder="Filter by name or client ID..."
            className="min-w-60"
            aria-label="Filter by name or client ID"
          />
          <DataTableMultiSelectFilter
            triggerLabel="Type"
            options={uniqueTypeValues.map((value) => ({
              value,
              label: value.charAt(0).toUpperCase() + value.slice(1),
              count: typeCounts.get(value),
            }))}
            selectedValues={selectedTypes}
            onChange={(value, checked) => handleTypesChange(value, checked)}
            onClear={() => table.getColumn("type")?.setFilterValue(undefined)}
          />
          <DataTableMultiSelectFilter
            triggerLabel="Status"
            options={[
              {
                value: "active",
                label: "Active",
                count: statusCounts.get(false) || 0,
              },
              {
                value: "disabled",
                label: "Disabled",
                count: statusCounts.get(true) || 0,
              },
            ]}
            selectedValues={selectedStatuses}
            onChange={(value, checked) => handleStatusChange(value, checked)}
            onClear={() =>
              table.getColumn("disabled")?.setFilterValue(undefined)
            }
          />
        </div>
        <div className="flex items-center gap-3">
          <CreateOIDCClientDialog onClientCreated={fetchClients} />
          <Button
            variant="outline"
            size="sm"
            onClick={fetchClients}
            disabled={loading}
          >
            Refresh
          </Button>
          <DataTableBulkDeleteDialog
            buttonSize="sm"
            selectedCount={selectedCount}
            onConfirm={handleDeleteRows}
            description={`This action cannot be undone. This will permanently delete ${selectedCount} selected ${selectedCount === 1 ? "client" : "clients"}.`}
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
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}
                      className="h-11"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <div
                          className={cn(
                            header.column.getCanSort() &&
                              "flex h-full cursor-pointer items-center justify-between gap-2 select-none"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                          onKeyDown={(e) => {
                            if (
                              header.column.getCanSort() &&
                              (e.key === "Enter" || e.key === " ")
                            ) {
                              e.preventDefault();
                              header.column.getToggleSortingHandler()?.(e);
                            }
                          }}
                          tabIndex={header.column.getCanSort() ? 0 : undefined}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {{
                            asc: (
                              <ChevronUpIcon
                                className="shrink-0 opacity-60"
                                size={16}
                                aria-hidden="true"
                              />
                            ),
                            desc: (
                              <ChevronDownIcon
                                className="shrink-0 opacity-60"
                                size={16}
                                aria-hidden="true"
                              />
                            ),
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      ) : (
                        (flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        ) as never)
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="last:py-0">
                      {
                        flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        ) as never
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {loading ? (
                    <Button variant="outline" disabled>
                      <LoaderIcon size="16" className="animate-spin" />
                      Loading
                    </Button>
                  ) : (
                    "No OIDC clients found."
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <DataTablePagination table={table} pageSizeOptions={[5, 10, 25, 50]} />

      {/* Total count display */}
      <div className="text-sm text-muted-foreground">
        Total: {clients.length} clients
      </div>
    </div>
  );
}

function RowActions({
  row,
  onRefresh,
}: {
  row: Row<OIDCClient>;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const client = row.original;

  const handleClientUpdated = () => {
    onRefresh();
  };

  const handleClientDeleted = () => {
    onRefresh();
  };

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="shadow-none"
        aria-label="Client actions"
        onClick={() => setOpen(true)}
      >
        <EllipsisIcon size={16} aria-hidden="true" />
      </Button>

      <OIDCClientDetailSheet
        client={client}
        open={open}
        onOpenChange={setOpen}
        onClientUpdated={handleClientUpdated}
        onClientDeleted={handleClientDeleted}
      />
    </>
  );
}
