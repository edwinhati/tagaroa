"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";
import { IconFilter, IconSearch, IconX } from "@tabler/icons-react";
import type { Table } from "@tanstack/react-table";
import { useCallback, useId, useMemo, useRef } from "react";

// Client-side (table-based) search props
export type DataTableSearchInputProps<TData> = Readonly<{
  table: Table<TData>;
  columnId: string;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  id?: string;
}>;

// Server-side (value/onChange) search props
export type ServerSearchInputProps = Readonly<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  id?: string;
}>;

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
    [providedId, internalId],
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
        <IconFilter size={16} aria-hidden="true" />
      </div>
      {Boolean(value) && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground/80 hover:text-foreground absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Clear filter"
          onClick={handleClear}
        >
          <IconX size={16} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
// Server-side search input for API-based filtering
export function ServerSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
  id: providedId,
  "aria-label": ariaLabel,
}: ServerSearchInputProps) {
  const internalId = useId();
  const inputId = useMemo(
    () => providedId ?? `${internalId}-server-search`,
    [providedId, internalId],
  );

  const handleClear = () => {
    onChange("");
  };

  return (
    <div className="relative">
      <Input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="text"
        aria-label={ariaLabel ?? placeholder}
        className={cn("peer ps-9", Boolean(value) && "pe-9", className)}
      />
      <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
        <IconSearch size={16} aria-hidden="true" />
      </div>
      {Boolean(value) && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground/80 hover:text-foreground absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Clear search"
          onClick={handleClear}
        >
          <IconX size={16} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
