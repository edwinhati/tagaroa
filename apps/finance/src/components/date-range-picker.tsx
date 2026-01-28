"use client";

import { useBudgetPeriod } from "@repo/common/hooks/use-budget-period";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  className?: string;
}

const DateRangePicker = ({
  date,
  onDateChange,
  className,
}: DateRangePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const { month, year } = useBudgetPeriod((s) => ({
    month: s.month,
    year: s.year,
  }));

  const handleSelect = (selected: DateRange | undefined) => {
    onDateChange(selected);
    if (selected?.from && !selected?.to) {
      setIsOpen(false);
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date-range"
            variant="outline"
            className={cn(
              "w-full sm:w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
            <ChevronDownIcon className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col space-y-2 p-2">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleSelect({
                    from: new Date(
                      month === 1 ? year - 1 : year,
                      month === 1 ? 11 : month - 2,
                      25,
                    ),
                    to: new Date(year, month - 1, 25),
                  });
                }}
              >
                This Period
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const startOfMonth = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1,
                  );
                  handleSelect({ from: startOfMonth, to: now });
                }}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const startOfLastMonth = new Date(
                    now.getFullYear(),
                    now.getMonth() - 1,
                    1,
                  );
                  const endOfLastMonth = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    0,
                  );
                  handleSelect({ from: startOfLastMonth, to: endOfLastMonth });
                }}
              >
                Last Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const startOfThisYear = new Date(now.getFullYear(), 0, 1);
                  handleSelect({ from: startOfThisYear, to: now });
                }}
              >
                This Year
              </Button>
            </div>
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
    </div>
  );
};

export { DateRangePicker };
