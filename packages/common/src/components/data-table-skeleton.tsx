import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { useMemo } from "react";

interface DataTableSkeletonProps {
  /**
   * Number of columns to show skeleton cells for
   */
  columnCount: number;
  /**
   * Number of skeleton rows to render
   * @default 5
   */
  rowCount?: number;
  /**
   * Number of skeleton search inputs (top left)
   * @default 1
   */
  searchableColumnCount?: number;
  /**
   * Number of skeleton filters (top left)
   * @default 2
   */
  filterableColumnCount?: number;
}

export function DataTableSkeleton({
  columnCount,
  rowCount = 5,
  searchableColumnCount = 1,
  filterableColumnCount = 2,
}: Readonly<DataTableSkeletonProps>) {
  const searchKeys = useMemo(
    () =>
      Array.from({ length: searchableColumnCount }, () => crypto.randomUUID()),
    [searchableColumnCount],
  );
  const filterKeys = useMemo(
    () =>
      Array.from({ length: filterableColumnCount }, () => crypto.randomUUID()),
    [filterableColumnCount],
  );
  const headerKeys = useMemo(
    () => Array.from({ length: columnCount }, () => crypto.randomUUID()),
    [columnCount],
  );
  const rowKeys = useMemo(
    () => Array.from({ length: rowCount }, () => crypto.randomUUID()),
    [rowCount],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          {!!searchableColumnCount &&
            searchKeys.map((key) => (
              <Skeleton key={key} className="h-8 w-[250px]" />
            ))}
          {filterKeys.map((key) => (
            <Skeleton key={key} className="h-8 w-[100px]" />
          ))}
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-[100px]" />
          <Skeleton className="h-8 w-[120px]" />
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {headerKeys.map((key) => (
                <TableHead key={key}>
                  <Skeleton className="h-4 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowKeys.map((rowKey) => (
              <TableRow key={rowKey}>
                {headerKeys.map((colKey) => (
                  <TableCell key={`${rowKey}-${colKey}`}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
