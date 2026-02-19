"use client";

import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { DataTableSearchInput } from "@repo/common/components/data-table-search-input";
import { Loading } from "@repo/common/components/loading";
import { useBudgetPeriod } from "@repo/common/hooks/use-budget-period";
import { useFilters } from "@repo/common/hooks/use-filters";
import {
  budgetItemMutationOptions,
  budgetMutationOptions,
  budgetQueryOptions,
} from "@repo/common/lib/query/budget-query";
import type { Budget, BudgetItem } from "@repo/common/types/budget";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import { Card, CardContent } from "@repo/ui/components/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import {
  IconAlertTriangle,
  IconBolt,
  IconCalendar,
  IconCar,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCreditCard,
  IconDots,
  IconHeart,
  IconHome,
  IconList,
  IconMovie,
  IconPencil,
  IconPigMoney,
  IconPlus,
  IconReceipt,
  IconSchool,
  IconShield,
  IconShirt,
  IconSparkles,
  IconToolsKitchen2,
  IconTrendingUp,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
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
import { useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";
import { TransactionsByCategoryDialog } from "@/components/transactions-by-category-dialog";
import { BudgetFormDialog } from "./budget-form-dialog";

// Cell renderer components - defined outside to avoid recreation on each render
const BudgetSelectHeaderCell = ({
  table,
}: {
  table: ReturnType<typeof useReactTable<BudgetItem>>;
}) => (
  <Checkbox
    checked={table.getIsAllPageRowsSelected()}
    indeterminate={table.getIsSomePageRowsSelected()}
    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
    aria-label="Select all"
  />
);

const BudgetSelectRowCell = ({ row }: { row: Row<BudgetItem> }) => (
  <Checkbox
    checked={row.getIsSelected()}
    onCheckedChange={(value) => row.toggleSelected(!!value)}
    aria-label="Select row"
  />
);

// Category color and icon mapping
export const CATEGORY_CONFIG: Record<
  string,
  {
    bg: string;
    text: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  food: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    icon: IconToolsKitchen2,
  },
  housing: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    icon: IconHome,
  },
  transportation: {
    bg: "bg-violet-100 dark:bg-violet-900/30",
    text: "text-violet-700 dark:text-violet-300",
    icon: IconCar,
  },
  utilities: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-300",
    icon: IconBolt,
  },
  entertainment: {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-700 dark:text-pink-300",
    icon: IconMovie,
  },
  healthcare: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    icon: IconHeart,
  },
  hygiene: {
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    text: "text-cyan-700 dark:text-cyan-300",
    icon: IconSparkles,
  },
  education: {
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    text: "text-indigo-700 dark:text-indigo-300",
    icon: IconSchool,
  },
  savings: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: IconPigMoney,
  },
  insurance: {
    bg: "bg-teal-100 dark:bg-teal-900/30",
    text: "text-teal-700 dark:text-teal-300",
    icon: IconShield,
  },
  installment: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    icon: IconReceipt,
  },
  laundry: {
    bg: "bg-sky-100 dark:bg-sky-900/30",
    text: "text-sky-700 dark:text-sky-300",
    icon: IconShirt,
  },
  tithes: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    icon: IconHeart,
  },
  other: {
    bg: "bg-slate-100 dark:bg-slate-900/30",
    text: "text-slate-700 dark:text-slate-300",
    icon: IconDots,
  },
};

const CategoryCell = ({ row }: { row: Row<BudgetItem> }) => {
  const categoryKey = row.getValue("category")?.toString().toLowerCase();
  const categoryDisplay = categoryKey?.replaceAll("_", " ");
  const config = CATEGORY_CONFIG[categoryKey ?? "other"] ??
    CATEGORY_CONFIG.other ?? {
      bg: "bg-slate-100 dark:bg-slate-900/30",
      text: "text-slate-700 dark:text-slate-300",
      icon: IconDots,
    };
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex items-center justify-center rounded-lg p-1.5",
          config.bg,
          config.text,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="font-medium capitalize">{categoryDisplay}</span>
    </div>
  );
};

const BudgetActionsHeaderCell = () => <span className="sr-only">Actions</span>;

const BudgetActionsCell = ({ row }: { row: Row<BudgetItem> }) => {
  const { month, year } = useBudgetPeriod((s) => ({
    month: s.month,
    year: s.year,
  }));

  const startDate = new Date(
    month === 1 ? year - 1 : year,
    month === 1 ? 11 : month - 2,
    25,
  );
  const endDate = new Date(year, month - 1, 25);
  const category = row.original.category;
  const budgetItemId = row.original.id as string;

  return (
    <div className="flex justify-end gap-2">
      <TransactionsByCategoryDialog
        category={category}
        budgetItemId={budgetItemId}
        startDate={startDate}
        endDate={endDate}
        trigger={
          <Button variant="ghost" size="sm" className="text-xs">
            <IconList className="h-3 w-3 mr-1" />
            View Transactions
          </Button>
        }
      />
    </div>
  );
};

interface BudgetSummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconColor: string;
}

const BudgetSummaryCard = ({
  title,
  value,
  icon,
  iconColor,
}: BudgetSummaryCardProps) => (
  <Card
    className={cn(
      "relative group",
      "motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out",
      "hover:shadow-lg hover:shadow-primary/5",
      "motion-safe:hover:-translate-y-0.5",
      "border-border/50 hover:border-primary/20",
      "bg-card/80 backdrop-blur-sm",
    )}
  >
    <CardContent className="flex items-center gap-4 p-5">
      <div
        className={cn(
          "flex items-center justify-center rounded-xl p-3",
          "motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-105",
          "ring-1 ring-current/10",
          iconColor,
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground motion-safe:transition-colors motion-safe:duration-200">
          {title}
        </p>
        <p className="text-2xl font-bold font-mono tracking-tight truncate group-hover:text-primary motion-safe:transition-colors motion-safe:duration-200">
          {value}
        </p>
      </div>
    </CardContent>
  </Card>
);

interface ProgressCellProps {
  row: Row<BudgetItem>;
}

const ProgressCell = ({ row }: ProgressCellProps) => {
  const [isAnimated, setIsAnimated] = useState(false);
  const allocation = Number.parseFloat(row.getValue("allocation")) || 0;
  const spent = row.original.spent || 0;
  const percentage = allocation > 0 ? (spent / allocation) * 100 : 0;
  const isOverBudget = spent > allocation;
  const isWarning = !isOverBudget && percentage > 80;
  const isHealthy = !isOverBudget && percentage <= 80;
  const remaining = allocation - spent;

  // Animate on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const progressColor = cn(
    "h-full rounded-full",
    isOverBudget && "bg-gradient-to-r from-destructive/80 to-destructive",
    isWarning && "bg-gradient-to-r from-amber-400 to-amber-500",
    isHealthy && "bg-gradient-to-r from-emerald-400 to-emerald-500",
  );

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className="w-full space-y-1.5 min-w-[140px] cursor-default group"
            role="group"
            aria-label={`${percentage.toFixed(0)}% of budget used`}
          >
            <div className="flex justify-between text-xs items-center">
              <span
                className={cn(
                  "font-semibold tabular-nums motion-safe:transition-colors motion-safe:duration-200",
                  isOverBudget && "text-destructive",
                  isWarning && "text-amber-600 dark:text-amber-400",
                  isHealthy && "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {percentage.toFixed(0)}%
              </span>
              <span className="text-muted-foreground font-mono text-[11px] group-hover:text-foreground motion-safe:transition-colors">
                {formatCurrency(spent)} / {formatCurrency(allocation)}
              </span>
            </div>
            <div className="h-2.5 w-full bg-muted/60 rounded-full overflow-hidden ring-1 ring-border/30">
              <div
                className={progressColor}
                style={{
                  width: isAnimated ? `${Math.min(percentage, 100)}%` : "0%",
                  transition: "width 700ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </div>
          </div>
        }
      />
      <TooltipContent side="top" className="text-xs">
        <div className="space-y-1">
          <p className="font-medium capitalize">
            {row.original.category.replaceAll("_", " ")}
          </p>
          <p>Spent: {formatCurrency(spent)}</p>
          <p>Budget: {formatCurrency(allocation)}</p>
          <p className={cn(isOverBudget && "text-destructive font-medium")}>
            {isOverBudget ? "Over by" : "Remaining"}:{" "}
            {formatCurrency(Math.abs(remaining))}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

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

  const { range, setRange } = useFilters((s) => ({
    range: s.range,
    setRange: s.setRange,
  }));

  // Initialize range from budget period if not set
  useEffect(() => {
    if (!range) {
      setRange({
        from: new Date(
          month === 1 ? year - 1 : year,
          month === 1 ? 11 : month - 2,
          25,
        ),
        to: new Date(year, month - 1, 25),
      });
    }
  }, [range, month, year, setRange]);

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

  // Memoized handler for budget item updates
  const handleBudgetItemUpdate = useMemo(
    () => (itemId: string, newAllocation: number) => {
      if (!tableData.id) {
        toast.error("Cannot update budget item", {
          description: "Missing budget ID",
        });
        return;
      }
      updateBudgetItem({
        itemId,
        allocation: newAllocation,
        budgetId: tableData.id,
      });
    },
    [tableData.id, updateBudgetItem],
  );

  const columns: ColumnDef<BudgetItem>[] = useMemo(
    () => [
      {
        id: "select",
        header: BudgetSelectHeaderCell,
        cell: BudgetSelectRowCell,
        size: 28,
        enableSorting: false,
        enableHiding: false,
      },
      {
        header: "Category",
        accessorKey: "category",
        cell: CategoryCell,
        size: 100,
        enableSorting: false,
      },
      {
        header: "Allocation",
        accessorKey: "allocation",
        cell: ({ row }) => (
          <EditableCell
            row={row}
            value={row.getValue("allocation")}
            onUpdate={(itemId, newAllocation) => {
              if (!row.original.id) {
                toast.error("Cannot update budget item", {
                  description: "Missing item ID",
                });
                return;
              }
              handleBudgetItemUpdate(itemId, newAllocation);
            }}
          />
        ),
        size: 140,
        enableSorting: false,
      },
      {
        header: "Progress",
        id: "progress",
        cell: ({ row }) => <ProgressCell row={row} />,
        size: 180,
        enableSorting: false,
      },
      {
        id: "actions",
        header: BudgetActionsHeaderCell,
        cell: ({ row }) => <BudgetActionsCell row={row} />,
        size: 100,
        enableSorting: false,
      },
    ],
    [handleBudgetItemUpdate],
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
      {/* Budget Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <BudgetSummaryCard
          title="Total Budget"
          value={formatCurrency(tableData.amount)}
          icon={<IconWallet className="h-5 w-5" />}
          iconColor="text-primary bg-primary/10"
        />
        <BudgetSummaryCard
          title="Allocated"
          value={formatCurrency(totalAllocated)}
          icon={<IconCreditCard className="h-5 w-5" />}
          iconColor="text-blue-500 bg-blue-50"
        />
        <BudgetSummaryCard
          title="Remaining"
          value={formatCurrency(remainingBudget)}
          icon={
            remainingBudget < 0 ? (
              <IconAlertTriangle className="h-5 w-5" />
            ) : (
              <IconTrendingUp className="h-5 w-5" />
            )
          }
          iconColor={
            remainingBudget < 0
              ? "text-destructive bg-destructive/10"
              : "text-green-500 bg-green-50"
          }
        />
      </div>

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
            <PopoverTrigger
              render={
                <Button variant="outline">
                  <IconCalendar className="h-4 w-4 mr-2" />
                  {range?.from &&
                    range?.to &&
                    `${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`}
                </Button>
              }
            />
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
                    className={cn(
                      "group/row",
                      "motion-safe:transition-colors motion-safe:duration-150",
                      "hover:bg-muted/60",
                      "focus-within:bg-muted/40 focus-within:ring-1 focus-within:ring-primary/20 focus-within:ring-inset",
                      row.getIsSelected() && "bg-primary/5 hover:bg-primary/10",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="last:py-0 motion-safe:transition-colors motion-safe:duration-150"
                      >
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
                                  <IconPlus
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
            <IconCheck className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCancel}
            className="h-8 w-8"
            aria-label="Cancel"
          >
            <IconX className="h-4 w-4" />
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
        <IconPencil className="h-3.5 w-3.5" />
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
            <IconCheck className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCancel}
            className="h-8 w-8"
            aria-label="Cancel"
          >
            <IconX className="h-4 w-4" />
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
        <IconPencil className="h-3.5 w-3.5" />
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
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => i).map((i) => (
        <TableRow
          key={`budget-skeleton-row-${i}`}
          className="pointer-events-none animate-in fade-in-50 duration-300"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {/* Checkbox */}
          <TableCell>
            <Skeleton className="h-4 w-4 rounded" />
          </TableCell>
          {/* Category with icon */}
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-4 w-20" />
            </div>
          </TableCell>
          {/* Allocation */}
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          {/* Progress */}
          <TableCell>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          </TableCell>
          {/* Actions */}
          <TableCell>
            <Skeleton className="h-8 w-28 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
