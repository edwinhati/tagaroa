export const PortfolioMode = {
  BACKTEST: "backtest",
  PAPER: "paper",
  LIVE: "live",
} as const;

export type PortfolioMode = (typeof PortfolioMode)[keyof typeof PortfolioMode];
