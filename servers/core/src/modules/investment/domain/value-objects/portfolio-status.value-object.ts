export const PortfolioStatus = {
  ACTIVE: "active",
  PAUSED: "paused",
  CLOSED: "closed",
} as const;

export type PortfolioStatus =
  (typeof PortfolioStatus)[keyof typeof PortfolioStatus];
