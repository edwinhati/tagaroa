import { IconLoader2 } from "@tabler/icons-react";
import * as React from "react";

export function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="m-0 p-3 border border-border rounded-md flex items-center text-sm text-muted-foreground"
    >
      <IconLoader2 className="w-4 h-4 animate-spin mr-2" />
      Loading
    </div>
  );
}
