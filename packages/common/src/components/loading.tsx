import React from "react";
import { LoaderIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";

export function Loading() {
  return (
    <Button
      disabled
      variant="outline"
      className="m-0 p-3 border border-gray-500 rounded-md flex items-center"
    >
      <LoaderIcon className="w-4 h-4 animate-spin mr-2" />
      Loading
    </Button>
  );
}
