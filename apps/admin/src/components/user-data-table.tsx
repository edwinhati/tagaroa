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
} from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/avatar";
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

import { authClient } from "@repo/common/lib/auth-client";
import { type UserWithRole } from "better-auth/plugins/admin";
import { UserDetailSheet } from "@/components/user-detail-sheet";
import { CreateUserDialog } from "@/components/create-user-dialog";

// Use the UserWithRole type from better-auth
type User = UserWithRole;

// Custom filter function for multi-column searching
const multiColumnFilterFn: FilterFn<User> = (row, _columnId, filterValue) => {
  const searchableRowContent =
    `${row.original.name} ${row.original.email}`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

// Helper function to determine user status
const getUserStatus = (user: User) => {
  const banned = user.banned;
  const banExpires = user.banExpires;

  if (!banned) return "active";

  const isExpired = banExpires && new Date(banExpires) < new Date();
  return isExpired ? "active" : "banned";
};

// Helper function to render status badge
const renderStatusBadge = (status: string) => {
  const variant = status === "banned" ? "destructive" : "secondary";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge variant={variant}>{label}</Badge>;
};

// Helper function to render empty values consistently
const renderEmptyValue = () => <span className="text-muted-foreground">—</span>;

const rolesFilterFn: FilterFn<User> = (
  row,
  _columnId,
  filterValue: string[],
) => {
  if (!filterValue?.length) return true;
  const role = row.getValue("role") as string;
  return filterValue.includes(role);
};

const statusFilterFn: FilterFn<User> = (
  row,
  _columnId,
  filterValue: string[],
) => {
  if (!filterValue?.length) return true;
  const status = getUserStatus(row.original);
  return filterValue.includes(status);
};

export function UserDataTable() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    banReason: false,
    banExpires: false,
  });
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "name",
      desc: true,
    },
  ]);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch users from Better Auth admin API
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authClient.admin.listUsers({
        query: {
          limit: pagination.pageSize,
          offset: pagination.pageIndex * pagination.pageSize,
          sortBy: sorting[0]?.id || "createdAt",
          sortDirection: sorting[0]?.desc ? "desc" : "asc",
        },
      });

      if (response.data) {
        setUsers(response.data.users);
        setTotal(response.data.total);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setError("Failed to fetch users. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize, pagination.pageIndex, sorting]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const columns: ColumnDef<User>[] = useMemo(
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
        header: "Avatar",
        accessorKey: "image",
        cell: ({ row }) => {
          const user = row.original;
          const name = user.name || user.email;
          const initials = name
            ? name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)
            : "U";

          return (
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.image || ""} alt={name} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          );
        },
        size: 60,
        enableSorting: false,
      },
      {
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="font-medium">{row.getValue("name") || "—"}</div>
        ),
        size: 180,
        filterFn: multiColumnFilterFn,
        enableHiding: false,
      },
      {
        header: "Email",
        accessorKey: "email",
        cell: ({ row }) => (
          <div className="text-muted-foreground">{row.getValue("email")}</div>
        ),
        size: 200,
      },
      {
        header: "Email Status",
        accessorKey: "emailVerified",
        cell: ({ row }) => {
          const verified = row.getValue("emailVerified") as boolean;
          return (
            <Badge variant={verified ? "default" : "destructive"}>
              {verified ? "Verified" : "Unverified"}
            </Badge>
          );
        },
        size: 120,
      },
      {
        header: "Role",
        accessorKey: "role",
        cell: ({ row }) => {
          const role = row.getValue("role") as string;
          return (
            <Badge
              className="capitalize"
              variant={role === "admin" ? "default" : "secondary"}
            >
              {role || "user"}
            </Badge>
          );
        },
        size: 100,
        filterFn: rolesFilterFn,
      },
      {
        header: "Status",
        accessorKey: "banned",
        cell: ({ row }) => {
          const status = getUserStatus(row.original);
          return renderStatusBadge(status);
        },
        size: 100,
        filterFn: statusFilterFn,
      },
      {
        header: "Ban Reason",
        accessorKey: "banReason",
        cell: ({ row }) => {
          const banReason = row.getValue("banReason") as string | null;
          const banned = row.original.banned;

          if (!banned || !banReason) {
            return renderEmptyValue();
          }

          return (
            <div className="max-w-[200px] truncate text-sm" title={banReason}>
              {banReason}
            </div>
          );
        },
        size: 200,
      },
      {
        header: "Ban Expires",
        accessorKey: "banExpires",
        cell: ({ row }) => {
          const banExpires = row.getValue("banExpires") as Date | string | null;
          const banned = row.original.banned;

          if (!banned || !banExpires) {
            return renderEmptyValue();
          }

          const expiryDate = new Date(banExpires);
          const isExpired = expiryDate < new Date();

          return (
            <div
              className={cn(
                "text-sm",
                isExpired ? "text-muted-foreground" : "text-destructive",
              )}
            >
              {isExpired ? "Expired" : expiryDate.toLocaleDateString()}
            </div>
          );
        },
        size: 120,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => <RowActions row={row} onRefresh={fetchUsers} />,
        size: 60,
        enableHiding: false,
      },
    ],
    [fetchUsers],
  );

  const handleDeleteRows = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedUserIds = selectedRows.map((row) => row.original.id);

    if (selectedUserIds.length === 0) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Delete users one by one using Better Auth admin removeUser
      const deletePromises = selectedUserIds.map((userId) =>
        authClient.admin.removeUser({ userId }),
      );

      await Promise.all(deletePromises);

      // Refresh the user list after successful deletion
      await fetchUsers();

      // Reset row selection
      table.resetRowSelection();
    } catch (error) {
      console.error("Failed to delete users:", error);
      setError(
        `Failed to delete ${selectedUserIds.length} selected user${selectedUserIds.length === 1 ? "" : "s"}. Please try again.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const tableData = useMemo(() => {
    return users;
  }, [users]);

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

  // Helper function to get column filter data
  const getColumnFilterData = useCallback(
    (columnId: string) => {
      const column = table.getColumn(columnId);
      return {
        column,
        uniqueValues: column
          ? Array.from(column.getFacetedUniqueValues().keys()).sort()
          : [],
        counts: column ? column.getFacetedUniqueValues() : new Map(),
        selectedValues: (column?.getFilterValue() as string[]) ?? [],
      };
    },
    [table],
  );

  const roleFilterData = getColumnFilterData("role");
  const statusFilterData = getColumnFilterData("banned");

  const selectedCount = table.getSelectedRowModel().rows.length;

  // Generic filter change handler to reduce duplication
  const handleFilterChange = useCallback(
    (columnId: string, value: string, checked: boolean) => {
      const filterValue = table
        .getColumn(columnId)
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
        .getColumn(columnId)
        ?.setFilterValue(newFilterValue.length ? newFilterValue : undefined);
    },
    [table],
  );

  const handleRolesChange = useCallback(
    (value: string, checked: boolean) => {
      handleFilterChange("role", value, checked);
    },
    [handleFilterChange],
  );

  const handleStatusChange = useCallback(
    (value: string, checked: boolean) => {
      handleFilterChange("banned", value, checked);
    },
    [handleFilterChange],
  );

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
            placeholder="Filter by name or email..."
            className="min-w-60"
            aria-label="Filter by name or email"
          />
          <DataTableMultiSelectFilter
            triggerLabel="Role"
            options={roleFilterData.uniqueValues.map((value) => ({
              value,
              label: value.charAt(0).toUpperCase() + value.slice(1),
              count: roleFilterData.counts.get(value),
            }))}
            selectedValues={roleFilterData.selectedValues}
            onChange={handleRolesChange}
            onClear={() => roleFilterData.column?.setFilterValue(undefined)}
          />
          <DataTableMultiSelectFilter
            triggerLabel="Status"
            options={[
              {
                value: "active",
                label: "Active",
                count: statusFilterData.counts.get(false) || 0,
              },
              {
                value: "banned",
                label: "Banned",
                count: statusFilterData.counts.get(true) || 0,
              },
            ]}
            selectedValues={statusFilterData.selectedValues}
            onChange={handleStatusChange}
            onClear={() => statusFilterData.column?.setFilterValue(undefined)}
          />
        </div>
        <div className="flex items-center gap-3">
          <CreateUserDialog onUserCreated={fetchUsers} />
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={loading}
          >
            Refresh
          </Button>
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
                              "flex h-full cursor-pointer items-center justify-between gap-2 select-none",
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                          onKeyDown={(e) => {
                            // Enhanced keyboard handling for sorting
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
                            header.getContext(),
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
                          header.getContext(),
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
                          cell.getContext(),
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
                    "No results."
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
      <div className="text-sm text-muted-foreground">Total: {total} users</div>
    </div>
  );
}

function RowActions({
  row,
  onRefresh,
}: {
  row: Row<User>;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const user = row.original;

  const handleUserUpdated = () => {
    onRefresh();
  };

  const handleUserDeleted = () => {
    onRefresh();
  };

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="shadow-none"
        aria-label="User actions"
        onClick={() => setOpen(true)}
      >
        <EllipsisIcon size={16} aria-hidden="true" />
      </Button>

      <UserDetailSheet
        user={user}
        open={open}
        onOpenChange={setOpen}
        onUserUpdated={handleUserUpdated}
        onUserDeleted={handleUserDeleted}
      />
    </>
  );
}
