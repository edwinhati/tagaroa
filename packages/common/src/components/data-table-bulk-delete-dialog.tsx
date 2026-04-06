"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Button, type buttonVariants } from "@repo/ui/components/button";
import { IconAlertCircle } from "@tabler/icons-react";
import { useState } from "react";

type ButtonVariantProps = NonNullable<Parameters<typeof buttonVariants>[0]>;

type DataTableBulkDeleteDialogProps = Readonly<{
  selectedCount: number;
  onConfirm: () => void | Promise<void>;
  triggerLabel?: string;
  confirmLabel?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
  buttonVariant?: ButtonVariantProps["variant"];
  buttonSize?: ButtonVariantProps["size"];
  buttonClassName?: string;
}>;

/**
 * Confirmation dialog helper for bulk deletion actions.
 */
export function DataTableBulkDeleteDialog({
  selectedCount,
  onConfirm,
  triggerLabel = "Delete",
  confirmLabel = "Delete",
  title = "Are you absolutely sure?",
  description,
  disabled,
  buttonVariant = "outline",
  buttonSize,
  buttonClassName,
}: DataTableBulkDeleteDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm();
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => !isSubmitting && setOpen(value)}
    >
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant={buttonVariant}
            size={buttonSize}
            className={buttonClassName}
            disabled={disabled || selectedCount === 0 || isSubmitting}
          >
            {triggerLabel}
            {selectedCount > 0 && (
              <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
                {selectedCount}
              </span>
            )}
          </Button>
        }
      />
      <AlertDialogContent>
        <div className="flex flex-col gap-2 max-sm:items-center sm:flex-row sm:gap-4">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full border"
            aria-hidden="true"
          >
            <IconAlertCircle className="opacity-80" size={16} />
          </div>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && (
              <AlertDialogDescription>{description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Deleting..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
