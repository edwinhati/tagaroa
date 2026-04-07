"use client";

export function DataTableEmptyState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center">
      <div className="text-muted-foreground">
        <h3 className="text-lg font-medium">No results found</h3>
        <p className="mt-1 text-sm">
          Try adjusting your search or filter criteria
        </p>
      </div>
    </div>
  );
}
