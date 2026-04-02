"use client";

import { Button } from "@repo/ui/components/button";
import { IconDownload, IconLoader2 } from "@tabler/icons-react";
import { type ComponentProps, useState } from "react";

type ButtonComponentProps = ComponentProps<typeof Button>;

type DataTableExportButtonProps = Readonly<{
  onClick: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  loadingLabel?: string;
  buttonVariant?: ButtonComponentProps["variant"];
  buttonSize?: ButtonComponentProps["size"];
  buttonClassName?: string;
}>;

/**
 * Export button component for data tables with loading state support.
 */
export function DataTableExportButton({
  onClick,
  loading = false,
  disabled,
  label = "Export",
  loadingLabel = "Exporting...",
  buttonVariant = "outline",
  buttonSize = "sm",
  buttonClassName,
}: DataTableExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleClick = async () => {
    try {
      setIsExporting(true);
      await onClick();
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = loading || isExporting;
  const isDisabled = disabled || isLoading;

  return (
    <Button
      variant={buttonVariant}
      size={buttonSize}
      className={buttonClassName}
      disabled={isDisabled}
      onClick={handleClick}
    >
      {isLoading ? (
        <>
          <IconLoader2 className="animate-spin" size={16} />
          {loadingLabel}
        </>
      ) : (
        <>
          <IconDownload size={16} />
          {label}
        </>
      )}
    </Button>
  );
}
