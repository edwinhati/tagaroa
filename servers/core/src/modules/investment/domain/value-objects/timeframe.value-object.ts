export const Timeframe = {
  ONE_MINUTE: "1m",
  FIVE_MINUTES: "5m",
  FIFTEEN_MINUTES: "15m",
  ONE_HOUR: "1h",
  FOUR_HOURS: "4h",
  ONE_DAY: "1d",
  ONE_WEEK: "1w",
} as const;

export type Timeframe = (typeof Timeframe)[keyof typeof Timeframe];
