"use client";

import { DataTableBulkDeleteDialog } from "@repo/common/components/data-table-bulk-delete-dialog";
import { DataTableView } from "@repo/common/components/data-table-view";
import { Loading } from "@repo/common/components/loading";
import { budgetHistoryQueryOptions } from "@repo/common/lib/query/budget-query";
import type { Budget, PaginatedBudgetsResult } from "@repo/common/types/budget";
import { Button, buttonVariants } from "@repo/ui/components/button";
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
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { cn } from "@repo/ui/lib/utils";
import {
  IconCalendar,
  IconChartBar,
  IconDots,
  IconPlus,
  IconWallet,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type PaginationState,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BudgetFormDialog } from "@/components/budget-form-dialog";
import { BudgetHistoryDetailSheet } from "@/components/budget-history-detail-sheet";

const formatCurrency = (value: number, currency = "IDR") => {
  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

type SummaryCardProps = Readonly<{
  title: string;
  value: string;
  icon: React.ReactNode;
  iconColor: string;
}>;

const SummaryCard = ({ title, value, icon, iconColor }: SummaryCardProps) => (
  <div
    className={cn(
      "relative group rounded-lg border bg-card p-5",
      "motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out",
      "hover:shadow-lg hover:shadow-primary/5",
      "motion-safe:hover:-translate-y-0.5",
      "border-border/50 hover:border-primary/20",
      "bg-card/80 backdrop-blur-sm",
    )}
  >
    <div className="flex items-center gap-4">
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
    </div>
  </div>
);

const HistorySummary = ({
  budgets,
  total,
}: Readonly<{
  budgets: ReadonlyArray<Budget>;
  total: number;
}>) => {
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
        icon={<IconCalendar className="h-5 w-5" />}
        iconColor="text-primary bg-primary/10"
      />
      <SummaryCard
        title="Total Amount"
        value={formatCurrency(totalAmount)}
        icon={<IconWallet className="h-5 w-5" />}
        iconColor="text-blue-500 bg-blue-50 dark:bg-blue-900/30"
      />
      <SummaryCard
        title="Average Budget"
        value={formatCurrency(avgAmount)}
        icon={<IconChartBar className="h-5 w-5" />}
        iconColor="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30"
      />
    </div>
  );
};

const BudgetHistorySelectHeaderCell = ({
  table,
}: {
  table: ReturnType<typeof useReactTable<Budget>>;
}) => (
  <Checkbox
    checked={table.getIsAllPageRowsSelected()}
    indeterminate={table.getIsSomePageRowsSelected()}
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

const PeriodCell = ({ row }: { row: Row<Budget> }) => {
  const month = row.original.month;
  const year = row.original.year;
  const date = new Date(year, month - 1);
  const monthName = date.toLocaleString("en-US", { month: "long" });

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center rounded-lg p-1.5 bg-primary/10 text-primary">
        <IconCalendar className="h-3.5 w-3.5" />
      </div>
      <span className="font-medium">
        {monthName} {year}
      </span>
    </div>
  );
};

const AmountCell = ({ row }: { row: Row<Budget> }) => {
  const formatted = formatCurrency(row.original.amount, row.original.currency);
  return <span className="font-mono font-medium">{formatted}</span>;
};

const BudgetHistoryActionsHeaderCell = () => (
  <span className="sr-only">Actions</span>
);

type BudgetTableMeta = {
  onViewBudget: (budget: Budget) => void;
};

const ActionsCell = ({
  row,
  table,
}: {
  row: Row<Budget>;
  table: ReturnType<typeof useReactTable<Budget>>;
}) => {
  const meta = table.options.meta as BudgetTableMeta | undefined;
  return meta?.onViewBudget ? (
    <RowActions row={row} onViewBudget={meta.onViewBudget} />
  ) : null;
};

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
  const [stableData, setStableData] = useState<PaginatedBudgetsResult | null>(
    null,
  );
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [viewingBudget, setViewingBudget] = useState<Budget | null>(null);
  const [showViewSheet, setShowViewSheet] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

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
        size: 60,
        enableSorting: false,
      },
    ],
    [],
  );

  useEffect(() => {
    if (budgetResponse && !error) {
      setStableData({
        budgets: budgetResponse.budgets || [],
        pagination: budgetResponse.pagination,
      });
      setIsInitialLoading(false);
    }
  }, [budgetResponse, error]);

  const tableData = useMemo(() => {
    return stableData?.budgets || [];
  }, [stableData?.budgets]);

  const paginationInfo = stableData?.pagination;
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
      onViewBudget: (budget: Budget) => {
        setViewingBudget(budget);
        setShowViewSheet(true);
      },
    },
  });

  const handleDeleteRows = () => {
    table.resetRowSelection();
  };

  const hasRows = table.getRowModel().rows.length > 0;
  const selectedCount = table.getSelectedRowModel().rows.length;

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-red-500">
          Error loading budgets: {error.message}
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return <BudgetHistoryTableSkeleton />;
  }

  return (
    <div className="relative space-y-4">
      <BudgetFormDialog
        initialData={editingBudget ?? undefined}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        trigger={null}
      />
      <BudgetHistoryDetailSheet
        budget={viewingBudget}
        open={showViewSheet}
        onOpenChange={setShowViewSheet}
        onEdit={() => {
          setEditingBudget(viewingBudget);
          setShowViewSheet(false);
          setShowEditDialog(true);
        }}
      />

      {hasTotalData && (
        <HistorySummary
          budgets={tableData}
          total={paginationInfo?.total ?? 0}
        />
      )}

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

      <DataTableView
        table={table}
        columnsLength={columns.length}
        hasRows={hasRows}
        hasTotalData={hasTotalData}
        hasActiveFilters={false}
        onRowClick={(budget) => {
          setViewingBudget(budget);
          setShowViewSheet(true);
        }}
        paginationInfo={
          paginationInfo
            ? {
                total: paginationInfo.total,
                page: paginationInfo.page,
                total_pages: paginationInfo.total_pages,
                has_next: paginationInfo.page < paginationInfo.total_pages,
                has_prev: paginationInfo.page > 1,
              }
            : undefined
        }
        emptyState={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
                <IconCalendar className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No Budget History</EmptyTitle>
              <EmptyDescription>
                You haven&apos;t created any budgets yet. Start by creating your
                first budget to track your monthly spending.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/budgets" className={buttonVariants({ size: "sm" })}>
                <IconPlus
                  className="-ms-1 opacity-60"
                  size={16}
                  aria-hidden="true"
                />
                Create Budget
              </Link>
            </EmptyContent>
          </Empty>
        }
      />
    </div>
  );
}

type RowActionsProps = Readonly<{
  row: Row<Budget>;
  onViewBudget: (budget: Budget) => void;
}>;

function RowActions({ row, onViewBudget }: RowActionsProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { month, year } = row.original;
  const router = useRouter();

  const handleNavigate = () => {
    router.push(`/budgets?month=${month}&year=${year}`);
  };

  return (
    <div className="flex justify-end">
      <BudgetFormDialog
        initialData={row.original}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        trigger={null}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              className="shadow-none"
              aria-label="Edit item"
            >
              <IconDots size={16} aria-hidden="true" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onViewBudget(row.original)}>
              <span>View</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleNavigate}>
              <span>Open in Budgets</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
              <span>Edit</span>
              <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function BudgetHistoryTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => i).map((i) => (
          <div
            key={`history-card-skeleton-${i}`}
            className="rounded-lg border bg-card p-5"
          >
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-muted" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-7 w-32 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="h-8 w-[100px] bg-muted rounded" />
      </div>

      <div className="rounded-lg border border-border/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-7 p-4">
                <div className="h-4 w-4 bg-muted rounded" />
              </th>
              <th className="p-4">
                <div className="h-4 w-16 bg-muted rounded" />
              </th>
              <th className="p-4">
                <div className="h-4 w-16 bg-muted rounded" />
              </th>
              <th className="p-4">
                <div className="h-4 w-16 bg-muted rounded" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }, (_, i) => i).map((i) => (
              <tr key={`history-skeleton-row-${i}`}>
                <td className="p-4">
                  <div className="h-4 w-4 bg-muted rounded" />
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 bg-muted rounded-lg" />
                    <div className="h-4 w-28 bg-muted rounded" />
                  </div>
                </td>
                <td className="p-4">
                  <div className="h-5 w-28 bg-muted rounded" />
                </td>
                <td className="p-4">
                  <div className="h-8 w-16 bg-muted rounded-md" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
