"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { flexRender, type Table as ReactTable } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { DataTableEmptyState } from "./data-table-empty-state";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableSortableHeader } from "./data-table-sortable-header";

export type DataTableViewProps<TData> = Readonly<{
  table: ReactTable<TData>;
  columnsLength: number;
  hasRows: boolean;
  hasTotalData: boolean;
  hasActiveFilters: boolean;
  emptyState: ReactNode;
  paginationInfo?: {
    total: number;
    page: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  tableContainerClassName?: string;
  tableClassName?: string;
  tableAriaLabel?: string;
}>;

export function DataTableView<TData>({
  table,
  columnsLength,
  hasRows,
  hasTotalData,
  hasActiveFilters,
  emptyState,
  paginationInfo,
  tableContainerClassName = "bg-background overflow-hidden rounded-md border",
  tableClassName,
  tableAriaLabel,
}: DataTableViewProps<TData>) {
  return (
    <>
      <div className={tableContainerClassName}>
        <Table
          role="table"
          className={tableClassName}
          aria-label={tableAriaLabel}
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
                  <TableCell colSpan={columnsLength} className="h-96">
                    <div className="flex h-full">
                      {renderEmptyState ? emptyState : <DataTableEmptyState />}
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
        pageSizeOptions={[10, 25, 50, 100]}
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
    </>
  );
}
