import { IconLoader2 } from "@tabler/icons-react";

export function Loading() {
  return (
    <output
      aria-label="Loading"
      className="m-0 p-3 border border-border rounded-md flex items-center text-sm text-muted-foreground"
    >
      <IconLoader2 className="w-4 h-4 animate-spin mr-2" />
      Loading
    </output>
  );
}
