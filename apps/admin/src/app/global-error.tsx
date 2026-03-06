"use client";

import { Button } from "@repo/ui/components/button";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-gray-500">
            {error.message || "A critical error occurred"}
          </p>
          <Button type="button" onClick={reset} variant="outline">
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
