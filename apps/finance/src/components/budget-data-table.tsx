"use client";

import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { DataTableSearchInput } from "@repo/common/components/data-table-search-input";
import { Loading } from "@repo/common/components/loading";
import { useBudgetPeriod } from "@repo/common/hooks/use-budget-period";
import {
  budgetItemMutationOptions,
  budgetMutationOptions,
  budgetQueryOptions,
} from "@repo/common/lib/query/budget-query";
import type { Budget, BudgetItem } from "@repo/common/types/budget";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
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
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  PlusIcon,
  Rows4Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";
import { BudgetFormDialog } from "./budget-form-dialog";

export function BudgetDataTable() {
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

  return <BudgetDataTableContent />;
}

function BudgetDataTableContent() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const { month, year, setMonth, setYear } = useBudgetPeriod((s) => ({
    month: s.month,
    year: s.year,
    setMonth: s.setMonth,
    setYear: s.setYear,
  }));

  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(
      month === 1 ? year - 1 : year,
      month === 1 ? 11 : month - 2,
      25,
    ),
    to: new Date(year, month - 1, 25),
  });

  // Stable data state to prevent re-renders during refetch
  const [stableData, setStableData] = useState<Budget | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [sorting, setSorting] = useState<SortingState>([]);

  const {
    data: budgetResponse,
    error,
    refetch,
  } = useQuery(budgetQueryOptions({ month, year }));

  const { mutate: updateBudgetItem } = useMutation({
    ...budgetItemMutationOptions(),
    onSuccess: () => {
      toast.success("Budget item updated successfully");
    },
    onError: (err) => {
      toast.error("Failed to update budget item", {
        description: err.message,
      });
    },
  });

  // Update stable data only when new data arrives, not during loading
  useEffect(() => {
    if (!error) {
      // Accept a null budget ("not found") and clear stable data so we render
      // the empty state instead of stale rows from a previous month.
      setStableData(budgetResponse ?? null);
      if (budgetResponse !== undefined) {
        setIsInitialLoading(false);
      }
      return;
    }

    // Stop loading on error to avoid a frozen skeleton state.
    setIsInitialLoading(false);
  }, [budgetResponse, error]);

  // Use stable data to prevent re-renders during refetch. Fall back to an empty
  // budget shape so the table remains typed correctly when data is not yet
  // available.
  const tableData = useMemo<Budget>(
    () =>
      stableData ?? {
        month,
        year,
        amount: 0,
        currency: "USD",
        items: [],
      },
    [stableData, month, year],
  );

  // Calculate total allocated and remaining budget
  const totalAllocated = useMemo(() => {
    return (tableData.items ?? []).reduce(
      (sum, item) => sum + (item.allocation || 0),
      0,
    );
  }, [tableData.items]);

  const remainingBudget = useMemo(() => {
    return tableData.amount - totalAllocated;
  }, [tableData.amount, totalAllocated]);

  const showLoadingState = isInitialLoading;

  // Check if there's truly no data (no accounts at all for the user)
  const hasTotalData = (budgetResponse?.items?.length ?? 0) > 0;

  const columns: ColumnDef<BudgetItem>[] = useMemo(
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
        header: "Category",
        accessorKey: "category",
        cell: ({ row }) => {
          const categoryValue = row
            .getValue("category")
            ?.toString()
            .replaceAll("_", "-");
          return categoryValue;
        },
        size: 100,
        enableSorting: false,
      },
      {
        header: "Allocation",
        accessorKey: "allocation",
        cell: ({ row }) => {
          return (
            <EditableCell
              row={row}
              value={row.getValue("allocation")}
              onUpdate={(itemId, newAllocation) => {
                if (!tableData.id || !row.original.id) {
                  toast.error("Cannot update budget item", {
                    description: "Missing budget or item ID",
                  });
                  return;
                }
                updateBudgetItem({
                  itemId,
                  allocation: newAllocation,
                  budgetId: tableData.id,
                  category: row.original.category,
                });
              }}
            />
          );
        },
        size: 120,
        enableSorting: false,
      },
      {
        header: "Remaining",
        accessorKey: "remaining",
        cell: ({ row }) => {
          const allocation = Number.parseFloat(row.getValue("allocation")) || 0;
          const spent = row.original.spent || 0;
          const remaining = allocation - spent;
          const formatted = new Intl.NumberFormat(
            tableData.currency === "IDR" ? "id-ID" : "en-US",
            {
              style: "currency",
              currency: tableData.currency,
            },
          ).format(remaining);
          return (
            <span className={cn(remaining < 0 && "text-destructive")}>
              {formatted}
            </span>
          );
        },
        size: 120,
        enableSorting: false,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: () => (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                // TODO: Implement show related transactions functionality
                toast.info("Feature coming soon", {
                  description:
                    "Related transactions view will be available soon",
                });
              }}
            >
              <Rows4Icon className="h-3 w-3 mr-1" />
              View Transactions
            </Button>
          </div>
        ),
        size: 100,
        enableSorting: false,
      },
    ],
    [tableData.currency, tableData.id, updateBudgetItem],
  );

  // TanStack Table exposes functions that React Compiler cannot memoize; suppress rule locally.
  const table = useReactTable({
    data: tableData.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      pagination,
      columnFilters,
    },
  });

  const hasRows = table.getRowModel().rows.length > 0;

  const onSelectRange = (
    selectedRange: DateRange | undefined,
    selectedDay?: Date,
  ) => {
    const targetDate = selectedDay ?? selectedRange?.to ?? selectedRange?.from;

    if (!targetDate) {
      setRange(selectedRange);
      return;
    }

    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();
    const targetDay = targetDate.getDate();

    const newRange: DateRange =
      targetDay < 25
        ? {
            from: new Date(targetYear, targetMonth - 1, 25),
            to: new Date(targetYear, targetMonth, 25),
          }
        : {
            from: new Date(targetYear, targetMonth, 25),
            to: new Date(targetYear, targetMonth + 1, 25),
          };

    const endDate = newRange.to ?? newRange.from;

    setRange(newRange);
    if (endDate) {
      setMonth(endDate.getMonth() + 1);
      setYear(endDate.getFullYear());
    }
    refetch();
  };

  return (
    <div className="relative space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <DataTableSearchInput
            table={table}
            columnId="category"
            placeholder="Filter by category..."
            aria-label="Filter by category"
            className="min-w-60"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon />
                {range?.from &&
                  range?.to &&
                  `${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden p-0 ml-4"
              align="end"
            >
              <Calendar
                className="w-full"
                mode="range"
                defaultMonth={range?.from}
                selected={range}
                onSelect={onSelectRange}
                fixedWeeks
                showOutsideDays
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-3">
          <EditableBudgetAmount
            budgetId={tableData.id}
            amount={tableData.amount}
            currency={tableData.currency}
            month={tableData.month}
            year={tableData.year}
            onUpdate={() => refetch()}
          />
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Allocated:</span>
            <span className="font-mono font-medium">
              {formatCurrency(totalAllocated)}
            </span>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Remaining:</span>
            <span
              className={cn(
                "font-mono font-medium",
                remainingBudget < 0 && "text-destructive",
                remainingBudget > 0 && "text-green-600",
              )}
            >
              {formatCurrency(remainingBudget)}
            </span>
          </div>
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
                return <BudgetTableSkeletonRows />;
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

              const renderEmptyState = !hasTotalData;
              return (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-96">
                    <div className="flex h-full">
                      {renderEmptyState ? (
                        <Empty>
                          <EmptyHeader>
                            <EmptyTitle>No Budget Yet</EmptyTitle>
                            <EmptyDescription>
                              You haven&apos;t created a budget for this period
                              yet. Start by setting allocation and categories to
                              plan your month.
                            </EmptyDescription>
                          </EmptyHeader>
                          <EmptyContent>
                            <BudgetFormDialog
                              trigger={
                                <Button size="sm">
                                  <PlusIcon
                                    className="-ms-1 opacity-60"
                                    size={16}
                                    aria-hidden="true"
                                  />
                                  Create budget
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
      <DataTablePagination table={table} pageSizeOptions={[10, 15, 20]} />
    </div>
  );
}

const EditableBudgetAmount = ({
  budgetId,
  amount,
  currency,
  month,
  year,
  onUpdate,
}: {
  budgetId?: string;
  amount: number;
  currency: string;
  month: number;
  year: number;
  onUpdate: () => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(amount);
  const inputRef = useRef<HTMLInputElement>(null);

  const { mutate: updateBudget } = useMutation({
    ...budgetMutationOptions(),
    onSuccess: () => {
      toast.success("Budget amount updated successfully");
      onUpdate();
    },
    onError: (err) => {
      toast.error("Failed to update budget amount", {
        description: err.message,
      });
    },
  });

  const handleSave = () => {
    if (!budgetId) {
      toast.error("Cannot update budget", {
        description: "Budget ID is missing",
      });
      setIsEditing(false);
      return;
    }

    if (!Number.isNaN(editValue) && editValue !== amount && editValue > 0) {
      updateBudget({
        id: budgetId,
        amount: editValue,
        currency,
        month,
        year,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(amount);
    setIsEditing(false);
  };

  useEffect(() => {
    if (!isEditing) {
      setEditValue(amount);
    }
  }, [amount, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <div className="w-48">
          <NumericFormat
            customInput={Input}
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={2}
            fixedDecimalScale
            prefix="Rp "
            placeholder="Rp 0,00"
            value={editValue}
            onValueChange={(values) => setEditValue(values.floatValue || 0)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            aria-label="Edit budget amount"
            autoFocus
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSave}
            className="h-8 w-8"
            aria-label="Save"
          >
            <CheckIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCancel}
            className="h-8 w-8"
            aria-label="Cancel"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm group">
      <span className="text-muted-foreground">Budget:</span>
      <span className="font-mono font-medium">{formatCurrency(amount)}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsEditing(true)}
        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
        disabled={!budgetId}
      >
        <PencilIcon className="h-3.5 w-3.5" />
        <span className="sr-only">Edit budget amount</span>
      </Button>
    </div>
  );
};

const EditableCell = ({
  value,
  row,
  onUpdate,
}: {
  value: number;
  row: Row<BudgetItem>;
  onUpdate: (id: string, value: number) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    if (!Number.isNaN(editValue) && editValue !== value) {
      onUpdate(row.original.id as string, editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <NumericFormat
            customInput={Input}
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={2}
            fixedDecimalScale
            prefix="Rp "
            placeholder="Rp 0,00"
            value={editValue}
            onValueChange={(values) => setEditValue(values.floatValue || 0)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            aria-label={`Edit allocation for ${row.original.category}`}
            autoFocus
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSave}
            className="h-8 w-8"
            aria-label="Save"
          >
            <CheckIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCancel}
            className="h-8 w-8"
            aria-label="Cancel"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between group">
      <div className="font-mono">{formatCurrency(value)}</div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsEditing(true)}
        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <PencilIcon className="h-3.5 w-3.5" />
        <span className="sr-only">Edit</span>
      </Button>
    </div>
  );
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

function BudgetTableSkeletonRows() {
  const skeletonRows = Array.from(
    { length: 5 },
    (_, i) => `budget-skeleton-row-${i}`,
  );
  const skeletonCells = Array.from(
    { length: 5 },
    (_, j) => `budget-skeleton-cell-${j}`,
  );

  return (
    <>
      {skeletonRows.map((rowKey) => (
        <TableRow key={rowKey} className="pointer-events-none">
          {skeletonCells.map((cellKey, j) => (
            <TableCell key={`${rowKey}-${cellKey}`}>
              <Skeleton
                className={j === 0 ? "h-4 w-4 rounded" : "h-5 w-full"}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
