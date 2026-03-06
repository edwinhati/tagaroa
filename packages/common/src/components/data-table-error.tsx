import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import {
  IconAlertCircle,
  IconFileOff,
  IconLock,
  IconPlugConnectedX,
  IconServerOff,
} from "@tabler/icons-react";
import type * as React from "react";

type ErrorType = "network" | "auth" | "not-found" | "server" | "unknown";

interface DataTableErrorProps extends React.ComponentProps<"div"> {
  error: Error | unknown;
  onRetry?: () => void;
}

function detectErrorType(error: Error | unknown): ErrorType {
  if (!error) return "unknown";

  const errorMessage =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("connection")
  ) {
    return "network";
  }

  if (
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("forbidden") ||
    errorMessage.includes("401") ||
    errorMessage.includes("403")
  ) {
    return "auth";
  }

  if (errorMessage.includes("not found") || errorMessage.includes("404")) {
    return "not-found";
  }

  if (
    errorMessage.includes("500") ||
    errorMessage.includes("502") ||
    errorMessage.includes("503") ||
    errorMessage.includes("server")
  ) {
    return "server";
  }

  return "unknown";
}

function getErrorConfig(errorType: ErrorType) {
  switch (errorType) {
    case "network":
      return {
        icon: IconPlugConnectedX,
        title: "Connection Problem",
        description:
          "Unable to connect to the server. Please check your internet connection and try again.",
        showRetry: true,
      };
    case "auth":
      return {
        icon: IconLock,
        title: "Access Denied",
        description:
          "You don't have permission to view this data. Please contact your administrator if you believe this is an error.",
        showRetry: false,
      };
    case "not-found":
      return {
        icon: IconFileOff,
        title: "Data Not Found",
        description:
          "The requested data could not be found. It may have been moved or deleted.",
        showRetry: true,
      };
    case "server":
      return {
        icon: IconServerOff,
        title: "Server Error",
        description:
          "The server encountered an error while processing your request. Please try again in a few moments.",
        showRetry: true,
      };
    default:
      return {
        icon: IconAlertCircle,
        title: "Something Went Wrong",
        description:
          "An unexpected error occurred while loading the data. Please try again.",
        showRetry: true,
      };
  }
}

function DataTableError({
  error,
  onRetry,
  className,
  ...props
}: DataTableErrorProps) {
  const errorType = detectErrorType(error);
  const config = getErrorConfig(errorType);
  const Icon = config.icon;

  return (
    <div
      data-slot="data-table-error"
      className={cn(
        "gap-4 rounded-lg border border-dashed p-12 flex w-full min-w-0 flex-col items-center justify-center text-center text-balance",
        className,
      )}
      {...props}
    >
      <div
        data-slot="data-table-error-header"
        className="gap-3 flex max-w-md flex-col items-center"
      >
        <div
          data-slot="data-table-error-icon"
          className="bg-destructive/10 text-destructive flex size-12 shrink-0 items-center justify-center rounded-lg"
        >
          <Icon className="size-6" />
        </div>
        <div
          data-slot="data-table-error-title"
          className="text-lg font-semibold tracking-tight"
        >
          {config.title}
        </div>
        <div
          data-slot="data-table-error-description"
          className="text-sm text-muted-foreground"
        >
          {config.description}
        </div>
      </div>
      {config.showRetry && onRetry && (
        <div
          data-slot="data-table-error-actions"
          className="gap-2 flex items-center"
        >
          <Button onClick={onRetry} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

export { DataTableError };
