export function calculateChange(previous: number, current: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function getPreviousPeriod(
  startDate: Date,
  endDate: Date,
): { start: Date; end: Date } {
  const duration = endDate.getTime() - startDate.getTime();
  const previousEnd = new Date(startDate.getTime() - 1); // One day before start
  const previousStart = new Date(previousEnd.getTime() - duration);

  return {
    start: previousStart,
    end: previousEnd,
  };
}

export function formatPeriod(
  date: Date,
  granularity: "day" | "week" | "month" | "year",
): string {
  switch (granularity) {
    case "day":
      return date.toISOString().split("T")[0]; // YYYY-MM-DD
    case "week": {
      const year = date.getFullYear();
      const week = getISOWeek(date);
      return `${year}-W${week.toString().padStart(2, "0")}`;
    }
    case "month": {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      return `${year}-${month}`;
    }
    case "year":
      return date.getFullYear().toString();
  }
}

function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
