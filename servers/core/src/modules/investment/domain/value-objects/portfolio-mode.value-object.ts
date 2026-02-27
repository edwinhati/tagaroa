export const PortfolioMode = {
  BACKTEST: "backtest",
  PAPER: "paper",
  LIVE: "live",
} as const;

export type PortfolioMode = (typeof PortfolioMode)[keyof typeof PortfolioMode];

const validModes = new Set<string>(Object.values(PortfolioMode));

export function isValidPortfolioMode(value: string): value is PortfolioMode {
  return validModes.has(value);
}
