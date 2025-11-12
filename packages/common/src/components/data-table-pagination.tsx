"use client";

import { type ReactNode } from "react";
import {
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Table } from "@tanstack/react-table";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@repo/ui/components/pagination";
import { Label } from "@repo/ui/components/label";
import { Button } from "@repo/ui/components/button";

export type DataTablePaginationProps<TData> = Readonly<{
  table: Table<TData>;
  pageSizeOptions?: number[];
  label?: string;
  trailingContent?: ReactNode;
  serverSidePagination?: {
    total: number;
    page: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}>;

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

/**
 * Shared pagination footer for TanStack tables.
 */
export function DataTablePagination<TData>({
  table,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  label = "Rows per page",
  trailingContent,
  serverSidePagination,
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;

  // Use server-side pagination info if available, otherwise fall back to client-side
  const rowCount = serverSidePagination?.total ?? table.getRowCount();
  const currentPage = serverSidePagination?.page ?? pageIndex + 1;
  const hasNext = serverSidePagination?.hasNext ?? table.getCanNextPage();
  const hasPrev = serverSidePagination?.hasPrev ?? table.getCanPreviousPage();

  const start = rowCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = rowCount === 0 ? 0 : Math.min(currentPage * pageSize, rowCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Label htmlFor="data-table-pagination" className="max-sm:sr-only">
          {label}
        </Label>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger
            id="data-table-pagination"
            className="w-fit whitespace-nowrap"
          >
            <SelectValue placeholder="Select number of results" />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((option) => (
              <SelectItem key={option} value={option.toString()}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-sm">
          Showing <span className="text-foreground">{start}</span> -{" "}
          <span className="text-foreground">{end}</span> of{" "}
          <span className="text-foreground">{rowCount}</span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        {trailingContent}
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                size="icon"
                variant="outline"
                className="disabled:pointer-events-none disabled:opacity-50"
                onClick={() => table.firstPage()}
                disabled={!hasPrev}
                aria-label="Go to first page"
              >
                <ChevronFirstIcon size={16} aria-hidden="true" />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                size="icon"
                variant="outline"
                className="disabled:pointer-events-none disabled:opacity-50"
                onClick={() => table.previousPage()}
                disabled={!hasPrev}
                aria-label="Go to previous page"
              >
                <ChevronLeftIcon size={16} aria-hidden="true" />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                size="icon"
                variant="outline"
                className="disabled:pointer-events-none disabled:opacity-50"
                onClick={() => table.nextPage()}
                disabled={!hasNext}
                aria-label="Go to next page"
              >
                <ChevronRightIcon size={16} aria-hidden="true" />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                size="icon"
                variant="outline"
                className="disabled:pointer-events-none disabled:opacity-50"
                onClick={() => table.lastPage()}
                disabled={!hasNext}
                aria-label="Go to last page"
              >
                <ChevronLastIcon size={16} aria-hidden="true" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
