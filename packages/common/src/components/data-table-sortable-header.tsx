"use client";

import { Button } from "@repo/ui/components/button";
import { TableHead } from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import type { Header } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

type DataTableSortableHeaderProps<TData> = Readonly<{
  header: Header<TData, unknown>;
}>;

export function DataTableSortableHeader<TData>({
  header,
}: DataTableSortableHeaderProps<TData>) {
  const widthStyle = { width: `${header.getSize()}px` };

  if (header.isPlaceholder) {
    return <TableHead key={header.id} style={widthStyle} className="h-11" />;
  }

  const canSort = header.column.getCanSort();
  const sortState = header.column.getIsSorted();
  const headerLabel = flexRender(
    header.column.columnDef.header,
    header.getContext(),
  );

  let ariaSort: "ascending" | "descending" | "none" | undefined;
  if (canSort) {
    if (sortState === "asc") {
      ariaSort = "ascending";
    } else if (sortState === "desc") {
      ariaSort = "descending";
    } else {
      ariaSort = "none";
    }
  }

  let headerContent = headerLabel;
  if (canSort) {
    const toggleSorting = header.column.getToggleSortingHandler();
    headerContent = (
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "flex h-8 select-none items-center justify-between gap-2 px-0 hover:bg-transparent focus-visible:ring-0",
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
      </Button>
    );
  }

  return (
    <TableHead
      key={header.id}
      style={widthStyle}
      className="h-11"
      aria-sort={ariaSort}
    >
      {headerContent}
    </TableHead>
  );
}
