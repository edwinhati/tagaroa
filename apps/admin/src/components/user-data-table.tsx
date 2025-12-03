"use client";

import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { DataTableMultiSelectFilter } from "@repo/common/components/data-table-multi-select-filter";
import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { ServerSearchInput } from "@repo/common/components/data-table-search-input";
import { authClient } from "@repo/common/lib/auth-client";
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
import { cn } from "@repo/ui/lib/utils";
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  type PaginationState,
  type Row,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import type { UserWithRole } from "better-auth/plugins/admin";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EllipsisIcon,
  LoaderIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreateUserDialog } from "@/components/create-user-dialog";
import { UserDetailSheet } from "@/components/user-detail-sheet";

// Use the UserWithRole type from better-auth
type User = UserWithRole;

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

function createUserColumns(onRefresh: () => void): ColumnDef<User>[] {
  return [
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
    },
    {
      header: "Status",
      accessorKey: "banned",
      cell: ({ row }) => {
        const status = getUserStatus(row.original);
        return renderStatusBadge(status);
      },
      size: 100,
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
      cell: ({ row }) => <RowActions row={row} onRefresh={onRefresh} />,
      size: 60,
      enableHiding: false,
    },
  ];
}

export function UserDataTable() {
  // Client-side table state (for UI only, not filtering)
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
      desc: false,
    },
  ]);

  // Server-side filtering and search state
  // These states control the actual API calls to Better Auth
  const [searchValue, setSearchValue] = useState<string>("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState<string>("");
  type ServerFilters = {
    role?: string[];
    emailVerified?: boolean[];
    banned?: boolean[];
  };

  const [serverFilters, setServerFilters] = useState<ServerFilters>({});

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search value
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchValue]);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  type UserQueryParams = {
    limit: number;
    offset: number;
    sortBy: string;
    sortDirection: "asc" | "desc";
    searchValue?: string;
    searchField?: "name" | "email";
    searchOperator?: "contains" | "starts_with" | "ends_with";
    filterField?: string;
    filterValue?: string | boolean;
    filterOperator?: "contains" | "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
  };

  // Fetch users from Better Auth admin API with server-side filtering and sorting
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const queryParams: UserQueryParams = {
        limit: pagination.pageSize,
        offset: pagination.pageIndex * pagination.pageSize,
        sortBy: sorting[0]?.id || "name",
        sortDirection: sorting[0]?.desc ? "desc" : "asc",
      };

      // Add search parameters (email only)
      if (debouncedSearchValue.trim()) {
        queryParams.searchValue = debouncedSearchValue.trim();
        queryParams.searchField = "email";
        queryParams.searchOperator = "contains";
      }

      // Add role filter
      if (serverFilters.role?.length) {
        queryParams.filterField = "role";
        queryParams.filterValue = serverFilters.role[0]; // Better Auth might only support single value
        queryParams.filterOperator = "eq";
      }

      // Add email verification filter
      if (serverFilters.emailVerified?.length) {
        queryParams.filterField = "emailVerified";
        queryParams.filterValue = serverFilters.emailVerified[0];
        queryParams.filterOperator = "eq";
      }

      // Add banned status filter
      if (serverFilters.banned?.length) {
        queryParams.filterField = "banned";
        queryParams.filterValue = serverFilters.banned[0];
        queryParams.filterOperator = "eq";
      }

      const response = await authClient.admin.listUsers({
        query: queryParams,
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
  }, [
    pagination.pageSize,
    pagination.pageIndex,
    sorting,
    debouncedSearchValue,
    serverFilters,
  ]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const columns = useMemo(() => createUserColumns(fetchUsers), [fetchUsers]);

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
    // Enable server-side pagination
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.pageSize),
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

  const tableRows = table.getRowModel().rows;
  const hasRows = tableRows.length > 0;
  const selectedCount = table.getSelectedRowModel().rows.length;
  const emptyStateContent = loading ? (
    <Button variant="outline" disabled>
      <LoaderIcon size="16" className="animate-spin" />
      Loading
    </Button>
  ) : (
    "No results."
  );

  // Server-side filter handlers
  const handleServerFilterChange = useCallback(
    (
      filterKey: keyof typeof serverFilters,
      value: string | boolean,
      checked: boolean,
    ) => {
      setServerFilters((prev) => {
        const currentValues = prev[filterKey] ?? [];
        const nextValues = checked
          ? [...currentValues, value]
          : currentValues.filter((v) => v !== value);

        const updatedFilters: ServerFilters = { ...prev };
        if (nextValues.length === 0) {
          delete updatedFilters[filterKey];
        } else if (filterKey === "role") {
          updatedFilters[filterKey] = nextValues.filter(
            (v): v is string => typeof v === "string",
          );
        } else {
          updatedFilters[filterKey] = nextValues.filter(
            (v): v is boolean => typeof v === "boolean",
          ) as ServerFilters[typeof filterKey];
        }

        setPagination((prevPagination) => ({
          ...prevPagination,
          pageIndex: 0,
        }));

        return updatedFilters;
      });
    },
    [],
  );

  const handleServerFilterClear = useCallback(
    (filterKey: keyof typeof serverFilters) => {
      setServerFilters((prev) => {
        const newFilters = { ...prev };
        delete newFilters[filterKey];

        // Reset to first page when filters change
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));

        return newFilters;
      });
    },
    [],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    // Reset to first page when search changes
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  // Static filter options (since we don't have aggregations from Better Auth)
  const roleOptions = [
    { value: "admin", label: "Admin", count: undefined },
    { value: "user", label: "User", count: undefined },
  ];

  const emailVerificationOptions = [
    { value: "true", label: "Verified", count: undefined },
    { value: "false", label: "Unverified", count: undefined },
  ];

  const statusOptions = [
    { value: "false", label: "Active", count: undefined },
    { value: "true", label: "Banned", count: undefined },
  ];

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
          <ServerSearchInput
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search by email..."
            className="min-w-60"
            aria-label="Search users by email"
          />
          <DataTableMultiSelectFilter
            triggerLabel="Role"
            options={roleOptions}
            selectedValues={serverFilters.role?.map(String) || []}
            onChange={(value, checked) =>
              handleServerFilterChange("role", value, checked)
            }
            onClear={() => handleServerFilterClear("role")}
          />
          <DataTableMultiSelectFilter
            triggerLabel="Email Status"
            options={emailVerificationOptions}
            selectedValues={serverFilters.emailVerified?.map(String) || []}
            onChange={(value, checked) =>
              handleServerFilterChange(
                "emailVerified",
                value === "true",
                checked,
              )
            }
            onClear={() => handleServerFilterClear("emailVerified")}
          />
          <DataTableMultiSelectFilter
            triggerLabel="Status"
            options={statusOptions}
            selectedValues={serverFilters.banned?.map(String) || []}
            onChange={(value, checked) =>
              handleServerFilterChange("banned", value === "true", checked)
            }
            onClear={() => handleServerFilterClear("banned")}
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
                          "flex h-full select-none items-center justify-between gap-2",
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
            {hasRows ? (
              tableRows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
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
                  {emptyStateContent}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <DataTablePagination
        table={table}
        pageSizeOptions={[5, 10, 25, 50]}
        serverSidePagination={{
          total: total,
          page: pagination.pageIndex + 1,
          totalPages: Math.ceil(total / pagination.pageSize),
          hasNext: (pagination.pageIndex + 1) * pagination.pageSize < total,
          hasPrev: pagination.pageIndex > 0,
        }}
      />

      {/* Total count display */}
      <div className="text-sm text-muted-foreground">Total: {total} users</div>
    </div>
  );
}

type RowActionsProps = Readonly<{
  row: Row<User>;
  onRefresh: () => void;
}>;

function RowActions({ row, onRefresh }: RowActionsProps) {
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
