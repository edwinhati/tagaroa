"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@repo/ui/components/native-select";
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
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ReactTable,
  type RowData,
  type TableOptions,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  Columns3Icon,
  DownloadIcon,
  SearchIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { text: sortFn_text },
});

export type DataTableInstance<TData extends RowData> = ReactTable<
  typeof dataTableFeatures,
  TData
>;

export const createDataTableColumnHelper = <TData extends RowData>() =>
  createColumnHelper<typeof dataTableFeatures, TData>();

export function useDataTable<TData extends RowData>(
  options: Omit<TableOptions<typeof dataTableFeatures, TData>, "features">,
): DataTableInstance<TData> {
  return useTable({ ...options, features: dataTableFeatures });
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

export function DataTableSortHeader({
  children,
  column,
}: {
  children: ReactNode;
  column: {
    getIsSorted: () => false | "asc" | "desc";
    toggleSorting: (descending?: boolean) => void;
  };
}) {
  const sorted = column.getIsSorted();
  const Icon =
    sorted === "asc"
      ? ArrowUpIcon
      : sorted === "desc"
        ? ArrowDownIcon
        : ArrowUpDownIcon;
  return (
    <button
      className="-mx-1 gap-1.5 px-1 flex items-center rounded-sm text-foreground transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={() => column.toggleSorting(sorted === "asc")}
      type="button"
    >
      {children}
      <Icon aria-hidden="true" className="size-3 text-muted-foreground" />
    </button>
  );
}

const isInteractive = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      "a,button,input,select,textarea,[role='button'],[role='menuitem'],[data-row-action]",
    ),
  );

export function DataTableView<TData extends RowData>({
  caption,
  className,
  columnClassName,
  empty = "No results.",
  mobileRow,
  onRowClick,
  table,
}: {
  caption: string;
  className?: string;
  columnClassName?: (columnId: string, kind: "head" | "cell") => string;
  empty?: ReactNode;
  mobileRow?: (row: TData) => ReactNode;
  onRowClick?: (row: TData) => void;
  table: DataTableInstance<TData>;
}) {
  const rows = table.getRowModel().rows;
  return (
    <>
      <div className={cn(mobileRow ? "md:block hidden" : "block", className)}>
        <Table aria-label={caption}>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        "h-8 font-medium text-[0.6875rem] tracking-[0.06em] text-muted-foreground uppercase",
                        columnClassName?.(header.column.id, "head"),
                      )}
                      key={header.id}
                    >
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  className={cn(onRowClick && "cursor-pointer")}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  key={row.id}
                  onClick={
                    onRowClick
                      ? (event) => {
                          if (!isInteractive(event.target))
                            onRowClick(row.original);
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className={cn(
                        "text-[0.8125rem]",
                        columnClassName?.(cell.column.id, "cell"),
                      )}
                      key={cell.id}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={Math.max(1, table.getVisibleLeafColumns().length)}
                >
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {mobileRow ? (
        <ul className="md:hidden gap-1 flex flex-col" aria-label={caption}>
          {rows.length ? (
            rows.map((row) => (
              <li className="px-3 py-2.5 rounded-md bg-muted/40" key={row.id}>
                {mobileRow(row.original)}
              </li>
            ))
          ) : (
            <li className="px-4 py-12 text-sm text-center text-muted-foreground">
              {empty}
            </li>
          )}
        </ul>
      ) : null}
    </>
  );
}

export function DataTableToolbar({
  children,
  onSearchChange,
  search,
  searchLabel,
  searchPlaceholder,
}: {
  children?: ReactNode;
  onSearchChange: (value: string) => void;
  search: string;
  searchLabel: string;
  searchPlaceholder: string;
}) {
  return (
    <div className="min-h-10 gap-2 px-3 py-2 flex flex-wrap items-center border-b border-border/60">
      <div className="min-w-52 gap-2 flex flex-1 items-center">
        <SearchIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <Input
          aria-label={searchLabel}
          autoComplete="off"
          className="h-8 max-w-80 px-0 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          name="q"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          value={search}
        />
      </div>
      {children}
    </div>
  );
}

export function DataTableFacet({
  label,
  onChange,
  options,
  selected,
}: {
  label: string;
  onChange: (values: string[]) => void;
  options: { value: string; label: string; count?: number }[];
  selected: string[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
        {label}
        {selected.length ? ` (${selected.length})` : ""}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              checked={selected.includes(option.value)}
              key={option.value}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, option.value]
                    : selected.filter((value) => value !== option.value),
                )
              }
            >
              <span className="flex-1">{option.label}</span>
              {option.count === undefined ? null : (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {option.count}
                </span>
              )}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DataTableColumnVisibility<TData extends RowData>({
  labels = {},
  table,
}: {
  labels?: Record<string, string>;
  table: DataTableInstance<TData>;
}) {
  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Choose visible columns"
        render={<Button size="icon-sm" variant="outline" />}
      >
        <Columns3Icon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Columns</DropdownMenuLabel>
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              checked={column.getIsVisible()}
              key={column.id}
              onCheckedChange={(checked) => column.toggleVisibility(checked)}
            >
              {labels[column.id] ?? column.id}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DataTablePagination<TData extends RowData>({
  countLabel,
  pageSizes = [10, 25, 50, 100],
  table,
}: {
  countLabel: string;
  pageSizes?: number[];
  table: DataTableInstance<TData>;
}) {
  const pageCount = Math.max(1, table.getPageCount());
  const pageSizeId = useId();
  return (
    <div className="min-h-10 gap-3 px-3 py-2 flex flex-wrap items-center justify-between border-t border-border/60">
      <span
        aria-live="polite"
        className="text-xs text-muted-foreground tabular-nums"
        role="status"
      >
        {countLabel}
      </span>
      <div className="gap-2 flex items-center">
        <label className="sr-only" htmlFor={pageSizeId}>
          Rows per page
        </label>
        <NativeSelect
          autoComplete="off"
          id={pageSizeId}
          name="page-size"
          onChange={(event) => table.setPageSize(Number(event.target.value))}
          size="sm"
          value={String(table.state.pagination.pageSize)}
        >
          {pageSizes.map((size) => (
            <NativeSelectOption key={size} value={size}>
              {size} rows
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="text-xs text-muted-foreground tabular-nums">
          Page {table.state.pagination.pageIndex + 1} of {pageCount}
        </span>
        <Button
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          size="sm"
          variant="ghost"
        >
          Previous
        </Button>
        <Button
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          size="sm"
          variant="ghost"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function DataTableSkeleton({
  columns = 5,
  rows = 6,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading table"
      role="status"
      className="rounded-lg bg-muted/40"
    >
      <div
        className="gap-3 p-3 grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns * rows }, (_, index) => (
          <Skeleton className="h-5" key={index} />
        ))}
      </div>
    </div>
  );
}

export function DataTableSelectionHeader({
  checked,
  onCheckedChange,
}: {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      aria-label="Select all rows"
      checked={checked === true}
      indeterminate={checked === "indeterminate"}
      onCheckedChange={onCheckedChange}
    />
  );
}

export function DataTableSelectionCell({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      aria-label="Select row"
      checked={checked}
      onCheckedChange={onCheckedChange}
    />
  );
}

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export function toCsv(rows: readonly Record<string, unknown>[]): string {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    columns.map(csvCell).join(","),
    ...rows.map((row) =>
      columns.map((column) => csvCell(row[column])).join(","),
    ),
  ].join("\n");
}

export function DataTableExportButton({
  filename,
  rows,
}: {
  filename: string;
  rows: readonly Record<string, unknown>[];
}) {
  return (
    <Button
      disabled={!rows.length}
      onClick={() => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(
          new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }),
        );
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
      }}
      size="sm"
      variant="outline"
    >
      <DownloadIcon aria-hidden="true" />
      Export
    </Button>
  );
}

export function DataTableDeleteDialog({
  confirmLabel = "Delete",
  description,
  onConfirm,
  open,
  onOpenChange,
  title,
}: {
  confirmLabel?: string;
  description: ReactNode;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} variant="destructive">
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type DataTableColumn<TData extends RowData> = ColumnDef<
  typeof dataTableFeatures,
  TData,
  unknown
>;
