import React from "react";
import { LoaderIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";

export function Loading() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ height: "100vh", width: "100vw" }}
    >
      <Button
        disabled
        variant="outline"
        className="m-0 p-3 border border-gray-500 rounded-md flex items-center"
      >
        <LoaderIcon className="w-4 h-4 animate-spin mr-2" />
        Loading
      </Button>
    </div>
  );
}
