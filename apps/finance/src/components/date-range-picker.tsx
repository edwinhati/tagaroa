"use client";

import { useBudgetPeriod } from "@repo/common/hooks/use-budget-period";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import { Separator } from "@repo/ui/components/separator";
import { cn } from "@repo/ui/lib/utils";
import { IconCalendar, IconChevronDown } from "@tabler/icons-react";
import {
  endOfMonth,
  format,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

type DateRangePickerProps = Readonly<{
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  className?: string;
}>;

export function DateRangePicker({
  date,
  onDateChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { month, year } = useBudgetPeriod((s) => ({
    month: s.month,
    year: s.year,
  }));

  const handleSelect = (selected: DateRange | undefined) => {
    onDateChange(selected);
    if (selected?.from && selected?.to) {
      setIsOpen(false);
    }
  };

  const presets = [
    {
      label: "This Month",
      getRange: () => {
        const now = new Date();
        return {
          from: startOfMonth(now),
          to: now,
        };
      },
    },
    {
      label: "Last Month",
      getRange: () => {
        const now = new Date();
        const lastMonth = subMonths(now, 1);
        return {
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth),
        };
      },
    },
    {
      label: "Last 3 Months",
      getRange: () => {
        const now = new Date();
        const threeMonthsAgo = subMonths(now, 3);
        return {
          from: startOfMonth(threeMonthsAgo),
          to: now,
        };
      },
    },
    {
      label: "YTD",
      getRange: () => {
        const now = new Date();
        return {
          from: startOfYear(now),
          to: now,
        };
      },
    },
    {
      label: "Last Year",
      getRange: () => {
        const now = new Date();
        const lastYear = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
        return {
          from: lastYear,
          to: lastYearEnd,
        };
      },
    },
    {
      label: "This Period",
      getRange: () => ({
        from: new Date(
          month === 1 ? year - 1 : year,
          month === 1 ? 11 : month - 2,
          25,
        ),
        to: new Date(year, month - 1, 25),
      }),
    },
  ];

  const dateLabel = (() => {
    if (!date?.from) {
      return <span>Pick a date range</span>;
    }

    const from = format(date.from, "LLL dd, y");
    if (date.to) {
      const to = format(date.to, "LLL dd, y");
      return (
        <>
          {from} - {to}
        </>
      );
    }

    return from;
  })();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button
            id="date-range"
            variant="outline"
            className={cn(
              "w-auto justify-start text-left font-normal",
              !date && "text-muted-foreground",
              className,
            )}
          >
            <IconCalendar className="mr-2 h-4 w-4" />
            {dateLabel}
            <IconChevronDown className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col space-y-2 p-2">
          <div className="grid grid-cols-3 gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => handleSelect(preset.getRange())}
                className="text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Separator />
          <Calendar
            mode="range"
            selected={date}
            onSelect={handleSelect}
            className="rounded-md border"
            numberOfMonths={2}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
