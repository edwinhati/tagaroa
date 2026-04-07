"use client";

import { Button } from "@repo/ui/components/button";

export default function ErrorBoundary({
  error,
  reset,
}: Readonly<{
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}>) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground text-sm">
        {error.message || "An unexpected error occurred"}
      </p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
