const FINANCE_TIME_ZONE = "Asia/Jakarta";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getDatePartsInTimeZone(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (!year || !month || !day) {
    throw new Error("Unable to parse transaction date");
  }

  return { year, month, day };
}

export function normalizeTransactionDate(dateInput: string): Date {
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError("Invalid transaction date");
  }

  const { year, month, day } = getDatePartsInTimeZone(
    parsed,
    FINANCE_TIME_ZONE,
  );

  // Persist as a date-only value anchored at UTC midnight.
  return new Date(Date.UTC(year, month - 1, day));
}
