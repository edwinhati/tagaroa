export function toNavResponse(data: {
  nav: number;
  cash: number;
  pricesFrom: "ohlcv" | "fallback";
  breakdown: Array<{
    ticker: string;
    side: string;
    quantity: number;
    price: number;
    priceDate: Date | null;
    isStale: boolean;
    value: number;
    isFallback: boolean;
  }>;
}): Record<string, unknown> {
  return {
    nav: data.nav,
    cash: data.cash,
    prices_from: data.pricesFrom,
    breakdown: data.breakdown.map((item) => ({
      ticker: item.ticker,
      side: item.side,
      quantity: item.quantity,
      price: item.price,
      price_date: item.priceDate,
      is_stale: item.isStale,
      value: item.value,
      is_fallback: item.isFallback,
    })),
  };
}
