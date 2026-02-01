"use client";

import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { DataTablePagination } from "@repo/common/components/data-table-pagination";
import { Loading } from "@repo/common/components/loading";
import { useBudgetPeriod } from "@repo/common/hooks/use-budget-period";
import { budgetHistoryQueryOptions } from "@repo/common/lib/query/budget-query";
import type { Budget, PaginatedBudgetsResult } from "@repo/common/types/budget";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
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
import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type PaginationState,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import {
  BarChart3,
  Calendar,
  ChevronDownIcon,
  ChevronUpIcon,
  Eye,
  PlusIcon,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

// Format currency helper
const formatCurrency = (value: number, currency = "IDR") => {
  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Summary card component matching main budget page
interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconColor: string;
}

const SummaryCard = ({ title, value, icon, iconColor }: SummaryCardProps) => (
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

// Summary stats section
const HistorySummary = ({
  budgets,
  total,
}: {
  budgets: Budget[];
  total: number;
}) => {
  const totalAmount = useMemo(
    () => budgets.reduce((sum, b) => sum + b.amount, 0),
    [budgets],
  );
  const avgAmount = useMemo(
    () => (total > 0 ? totalAmount / total : 0),
    [totalAmount, total],
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <SummaryCard
        title="Total Budgets"
        value={total.toString()}
        icon={<Calendar className="h-5 w-5" />}
        iconColor="text-primary bg-primary/10"
      />
      <SummaryCard
        title="Total Amount"
        value={formatCurrency(totalAmount)}
        icon={<Wallet className="h-5 w-5" />}
        iconColor="text-blue-500 bg-blue-50 dark:bg-blue-900/30"
      />
      <SummaryCard
        title="Average Budget"
        value={formatCurrency(avgAmount)}
        icon={<BarChart3 className="h-5 w-5" />}
        iconColor="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30"
      />
    </div>
  );
};

// Cell renderer components
const BudgetHistorySelectHeaderCell = ({
  table,
}: {
  table: ReturnType<typeof useReactTable<Budget>>;
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

const BudgetHistorySelectRowCell = ({ row }: { row: Row<Budget> }) => (
  <Checkbox
    checked={row.getIsSelected()}
    onCheckedChange={(value) => row.toggleSelected(!!value)}
    aria-label="Select row"
  />
);

// Combined Period Cell with icon
const PeriodCell = ({ row }: { row: Row<Budget> }) => {
  const month = row.original.month;
  const year = row.original.year;
  const date = new Date(year, month - 1);
  const monthName = date.toLocaleString("en-US", { month: "long" });

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center rounded-lg p-1.5 bg-primary/10 text-primary">
        <Calendar className="h-3.5 w-3.5" />
      </div>
      <span className="font-medium">
        {monthName} {year}
      </span>
    </div>
  );
};

// Amount cell with currency formatting
const AmountCell = ({ row }: { row: Row<Budget> }) => {
  const formatted = formatCurrency(row.original.amount, row.original.currency);
  return <span className="font-mono font-medium">{formatted}</span>;
};

// Actions cell with view button
const ActionsCell = ({ row }: { row: Row<Budget> }) => {
  const { month, year } = row.original;
  const { setMonth, setYear } = useBudgetPeriod((s) => ({
    setMonth: s.setMonth,
    setYear: s.setYear,
  }));
  const router = useRouter();

  const handleView = () => {
    setMonth(month);
    setYear(year);
    router.push("/budgets");
  };

  return (
    <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 motion-safe:transition-opacity">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5"
        onClick={handleView}
      >
        <Eye className="h-4 w-4" />
        View
      </Button>
    </div>
  );
};

const BudgetHistoryActionsHeaderCell = () => (
  <span className="sr-only">Actions</span>
);

export function BudgetHistoryDataTable() {
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

  return <BudgetHistoryDataTableContent />;
}

function BudgetHistoryDataTableContent() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Stable data state to prevent re-renders during refetch
  const [stableData, setStableData] = useState<PaginatedBudgetsResult | null>(
    null,
  );
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const { data: budgetResponse, error } = useQuery(
    budgetHistoryQueryOptions({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
    }),
  );

  const columns: ColumnDef<Budget>[] = useMemo(
    () => [
      {
        id: "select",
        header: BudgetHistorySelectHeaderCell,
        cell: BudgetHistorySelectRowCell,
        size: 28,
        enableSorting: false,
      },
      {
        id: "period",
        header: "Period",
        cell: PeriodCell,
        size: 180,
        enableSorting: false,
      },
      {
        id: "amount",
        header: "Amount",
        cell: AmountCell,
        size: 150,
        enableSorting: false,
      },
      {
        id: "actions",
        header: BudgetHistoryActionsHeaderCell,
        cell: ActionsCell,
        size: 100,
        enableSorting: false,
      },
    ],
    [],
  );

  // Update stable data only when new data arrives, not during loading
  useEffect(() => {
    if (budgetResponse && !error) {
      setStableData({
        budgets: budgetResponse.budgets || [],
        pagination: budgetResponse.pagination,
      });
      setIsInitialLoading(false);
    }
  }, [budgetResponse, error]);

  // Use stable data to prevent re-renders during refetch
  const tableData = useMemo(() => {
    return stableData?.budgets || [];
  }, [stableData?.budgets]);

  const paginationInfo = stableData?.pagination;
  const showLoadingState = isInitialLoading;

  // Check if there's truly no data (no budgets at all for the user)
  const hasTotalData = (paginationInfo?.total ?? 0) > 0;

  // TanStack Table exposes functions that React Compiler cannot memoize
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: paginationInfo?.totalPages ?? 0,
    onPaginationChange: setPagination,
    state: {
      pagination,
    },
  });

  const hasRows = table.getRowModel().rows.length > 0;
  const selectedCount = table.getSelectedRowModel().rows.length;

  const handleDeleteRows = () => {
    table.resetRowSelection();
  };

  // Show error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-red-500">
          Error loading budgets: {error.message}
        </div>
      </div>
    );
  }

  // Show initial loading state only on first load
  if (isInitialLoading) {
    return <BudgetHistoryTableSkeleton />;
  }

  return (
    <div className="relative space-y-4">
      {/* Summary Stats */}
      {hasTotalData && (
        <HistorySummary
          budgets={tableData}
          total={paginationInfo?.total ?? 0}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
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
      <div className="bg-background overflow-hidden rounded-lg border border-border/50">
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
                return <BudgetHistorySkeletonRows />;
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
                        <Empty className="py-12">
                          <EmptyMedia
                            variant="icon"
                            className="bg-primary/10 text-primary"
                          >
                            <Calendar className="h-6 w-6" />
                          </EmptyMedia>
                          <EmptyHeader>
                            <EmptyTitle>No Budget History</EmptyTitle>
                            <EmptyDescription>
                              You haven&apos;t created any budgets yet. Start by
                              creating your first budget to track your monthly
                              spending.
                            </EmptyDescription>
                          </EmptyHeader>
                          <EmptyContent>
                            <Button size="sm" asChild>
                              <Link href="/budgets">
                                <PlusIcon
                                  className="-ms-1 opacity-60"
                                  size={16}
                                  aria-hidden="true"
                                />
                                Create Budget
                              </Link>
                            </Button>
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
      <DataTablePagination
        table={table}
        pageSizeOptions={[5, 10, 25, 50]}
        serverSidePagination={
          paginationInfo
            ? {
                total: paginationInfo.total,
                page: paginationInfo.page,
                totalPages: paginationInfo.totalPages,
                hasNext: paginationInfo.page < paginationInfo.totalPages,
                hasPrev: paginationInfo.page > 1,
              }
            : undefined
        }
      />
    </div>
  );
}

// Skeleton rows matching actual column structure
function BudgetHistorySkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => i).map((i) => (
        <TableRow
          key={`history-skeleton-row-${i}`}
          className="pointer-events-none animate-in fade-in-50 duration-300"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {/* Checkbox */}
          <TableCell>
            <Skeleton className="h-4 w-4 rounded" />
          </TableCell>
          {/* Period with icon */}
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-4 w-28" />
            </div>
          </TableCell>
          {/* Amount */}
          <TableCell>
            <Skeleton className="h-5 w-28" />
          </TableCell>
          {/* Actions */}
          <TableCell>
            <Skeleton className="h-8 w-16 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// Full page skeleton for initial load
function BudgetHistoryTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary cards skeleton */}
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => i).map((i) => (
          <Card key={`history-card-skeleton-${i}`} className="border-border/50">
            <CardContent className="flex items-center gap-4 p-5">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-[100px]" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-7">
                <Skeleton className="h-4 w-4 rounded" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <BudgetHistorySkeletonRows />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
