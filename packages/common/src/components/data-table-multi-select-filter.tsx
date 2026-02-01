"use client";

import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Label } from "@repo/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import { FilterIcon } from "lucide-react";
import { useId } from "react";

export type DataTableMultiSelectOption = Readonly<{
  value: string;
  label: string;
  count?: number | string;
}>;

export type DataTableMultiSelectFilterProps = Readonly<{
  triggerLabel: string;
  options: DataTableMultiSelectOption[];
  selectedValues: string[];
  onChange: (value: string, checked: boolean) => void;
  onClear?: () => void;
  emptyLabel?: string;
  popoverLabel?: string;
  buttonClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;

/**
 * Popover-driven multi-select filter used by multiple tables.
 */
export function DataTableMultiSelectFilter({
  triggerLabel,
  options,
  selectedValues,
  onChange,
  onClear,
  emptyLabel = "No results",
  popoverLabel = "Filters",
  buttonClassName,
  open,
  onOpenChange,
}: DataTableMultiSelectFilterProps) {
  const idPrefix = useId();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={buttonClassName}>
          <FilterIcon
            className="-ms-1 opacity-60"
            size={16}
            aria-hidden="true"
          />
          {triggerLabel}
          {selectedValues.length > 0 && (
            <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
              {selectedValues.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-36 p-3" align="start">
        <div className="space-y-3">
          <div className="text-muted-foreground text-xs font-medium">
            {popoverLabel}
          </div>
          <div className="space-y-3">
            {options.length === 0 && (
              <span className="text-muted-foreground text-xs">
                {emptyLabel}
              </span>
            )}
            {options.map((option, index) => {
              const optionId = `${idPrefix}-${index}`;
              const isChecked = selectedValues.includes(option.value);
              return (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    id={optionId}
                    checked={isChecked}
                    onCheckedChange={(checked: boolean) =>
                      onChange(option.value, checked)
                    }
                  />
                  <Label
                    htmlFor={optionId}
                    className="flex grow justify-between gap-2 font-normal"
                  >
                    {option.label}
                    {option.count !== undefined && (
                      <span className="text-muted-foreground ms-2 text-xs">
                        {option.count}
                      </span>
                    )}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
        {onClear && selectedValues.length > 0 && (
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onClear?.()}
            >
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
