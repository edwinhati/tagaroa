export type CandlePoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ComputedMetrics = {
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  dayClose: number;
  prevClose: number | null;
  dailyChange: number | null;
  dailyChangePct: number | null;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  sma50: number | null;
  sma200: number | null;
  volatility30d: number | null;
  avgVolume20d: number | null;
  aboveSma50: boolean | null;
  aboveSma200: boolean | null;
};

export function computeMetrics(candles: CandlePoint[]): ComputedMetrics | null {
  if (!candles.length) return null;

  const sorted = [...candles].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const latest = sorted.at(-1);
  const previous = sorted.length >= 2 ? (sorted.at(-2) ?? null) : null;
  if (!latest) return null;

  const prevClose = previous?.close ?? null;
  const dailyChange = prevClose != null ? latest.close - prevClose : null;
  const dailyChangePct =
    dailyChange != null && prevClose ? (dailyChange / prevClose) * 100 : null;

  // 52-week: last 252 trading days
  const last252 = sorted.slice(-252);
  const fiftyTwoWeekHigh = Math.max(...last252.map((c) => c.high));
  const fiftyTwoWeekLow = Math.min(...last252.map((c) => c.low));

  // Simple moving averages
  const sma = (period: number): number | null => {
    if (sorted.length < period) return null;
    const slice = sorted.slice(-period);
    return slice.reduce((s, c) => s + c.close, 0) / slice.length;
  };

  const sma50 = sma(50);
  const sma200 = sma(200);

  // 30-day annualized volatility (log returns)
  const last31 = sorted.slice(-31);
  let volatility30d: number | null = null;
  if (last31.length >= 10) {
    const logReturns: number[] = [];
    for (let i = 1; i < last31.length; i++) {
      const cur = last31[i];
      const prev = last31[i - 1];
      if (cur && prev) logReturns.push(Math.log(cur.close / prev.close));
    }
    const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
    const variance =
      logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) /
      (logReturns.length - 1);
    volatility30d = Math.sqrt(variance) * Math.sqrt(252);
  }

  // 20-day average volume
  const last20 = sorted.slice(-20);
  const hasVolume = last20.some((c) => (c.volume ?? 0) > 0);
  const avgVolume20d = hasVolume
    ? last20.reduce((s, c) => s + (c.volume ?? 0), 0) / last20.length
    : null;

  return {
    dayOpen: latest.open,
    dayHigh: latest.high,
    dayLow: latest.low,
    dayClose: latest.close,
    prevClose,
    dailyChange,
    dailyChangePct,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    sma50,
    sma200,
    volatility30d,
    avgVolume20d,
    aboveSma50: sma50 != null ? latest.close > sma50 : null,
    aboveSma200: sma200 != null ? latest.close > sma200 : null,
  };
}
