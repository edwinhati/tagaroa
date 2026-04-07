import type { ColumnDef } from "@tanstack/react-table";

/**
 * Resolves a stable string key for a TanStack Table column definition,
 * using the column's `id`, then `accessorKey`, then a numeric fallback.
 */
export function resolveColumnKey<TData>(
  column: ColumnDef<TData>,
  fallbackIndex: number,
): string {
  if (column.id) {
    return column.id;
  }
  if ("accessorKey" in column) {
    const accessorKey = (column as { accessorKey?: string | number })
      .accessorKey;
    if (accessorKey !== undefined) {
      return accessorKey.toString();
    }
  }
  return `col-${fallbackIndex}`;
}
