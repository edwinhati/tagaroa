import { Calendar } from "@repo/ui";

export const Month = () => (
  <Calendar
    mode="single"
    selected={new Date(2024, 4, 15)}
    defaultMonth={new Date(2024, 4, 1)}
    className="rounded-md border"
  />
);

export const Range = () => (
  <Calendar
    mode="range"
    selected={{ from: new Date(2024, 4, 10), to: new Date(2024, 4, 16) }}
    defaultMonth={new Date(2024, 4, 1)}
    className="rounded-md border"
  />
);
