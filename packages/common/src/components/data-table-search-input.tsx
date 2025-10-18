"use client";

import { Table } from "@tanstack/react-table";
import { CircleXIcon, ListFilterIcon } from "lucide-react";
import React, { useCallback, useId, useMemo, useRef } from "react";

import { cn } from "@repo/ui/lib/utils";
import { Input } from "@repo/ui/components/input";

export type DataTableSearchInputProps<TData> = {
  table: Table<TData>;
  columnId: string;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  id?: string;
};

export function DataTableSearchInput<TData>({
  table,
  columnId,
  placeholder = "Search...",
  className,
  id: providedId,
  "aria-label": ariaLabel,
}: DataTableSearchInputProps<TData>) {
  const internalId = useId();
  const inputId = useMemo(
    () => providedId ?? `${internalId}-search`,
    [providedId, internalId]
  );
  const column = table.getColumn(columnId);
  const value = (column?.getFilterValue() ?? "") as string;
  const localRef = useRef<HTMLInputElement | null>(null);

  const handleRef = useCallback((node: HTMLInputElement | null) => {
    localRef.current = node;
  }, []);

  const handleClear = () => {
    column?.setFilterValue("");
    if (localRef.current) {
      localRef.current.focus();
    }
  };

  return (
    <div className="relative">
      <Input
        id={inputId}
        ref={handleRef}
        value={value}
        onChange={(event) => column?.setFilterValue(event.target.value)}
        placeholder={placeholder}
        type="text"
        aria-label={ariaLabel ?? placeholder}
        className={cn("peer ps-9", Boolean(value) && "pe-9", className)}
      />
      <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
        <ListFilterIcon size={16} aria-hidden="true" />
      </div>
      {Boolean(value) && (
        <button
          type="button"
          className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Clear filter"
          onClick={handleClear}
        >
          <CircleXIcon size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
