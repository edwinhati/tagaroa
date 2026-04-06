export type CandlePoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type ComputedMetrics = {
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

function calculateSma(sorted: CandlePoint[], period: number): number | null {
  if (sorted.length < period) return null;
  const slice = sorted.slice(-period);
  return slice.reduce((s, c) => s + c.close, 0) / slice.length;
}

function calculateVolatility30d(sorted: CandlePoint[]): number | null {
  const last31 = sorted.slice(-31);
  if (last31.length < 10) return null;

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
  return Math.sqrt(variance) * Math.sqrt(252);
}

function calculateAvgVolume20d(sorted: CandlePoint[]): number | null {
  const last20 = sorted.slice(-20);
  const hasVolume = last20.some((c) => (c.volume ?? 0) > 0);
  return hasVolume
    ? last20.reduce((s, c) => s + (c.volume ?? 0), 0) / last20.length
    : null;
}

export function computeMetrics(candles: CandlePoint[]): ComputedMetrics | null {
  if (!candles.length) return null;

  const sorted = [...candles].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const latest = sorted.at(-1);
  const previous = sorted.length >= 2 ? (sorted.at(-2) ?? null) : null;
  if (!latest) return null;

  const prevClose = previous?.close ?? null;
  const dailyChange = prevClose == null ? null : latest.close - prevClose;
  const dailyChangePct =
    dailyChange == null || !prevClose ? null : (dailyChange / prevClose) * 100;

  // 52-week: last 252 trading days
  const last252 = sorted.slice(-252);
  const fiftyTwoWeekHigh = Math.max(...last252.map((c) => c.high));
  const fiftyTwoWeekLow = Math.min(...last252.map((c) => c.low));

  const sma50 = calculateSma(sorted, 50);
  const sma200 = calculateSma(sorted, 200);
  const volatility30d = calculateVolatility30d(sorted);
  const avgVolume20d = calculateAvgVolume20d(sorted);

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
    aboveSma50: sma50 == null ? null : latest.close > sma50,
    aboveSma200: sma200 == null ? null : latest.close > sma200,
  };
}
