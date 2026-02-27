import { Injectable, Logger } from "@nestjs/common";
import { Ohlcv } from "../../domain/market-data/entities/ohlcv.entity";
import type {
  IMarketDataProvider,
  OhlcvRequest,
} from "../../domain/market-data/interfaces/market-data-provider.interface";
import { AssetClass } from "../../domain/value-objects/asset-class.value-object";
import { Timeframe } from "../../domain/value-objects/timeframe.value-object";
import { yahooRateLimiter } from "./rate-limiter";

// Yahoo Finance does not support a native 4h interval; map it to 1h as the closest available.
// Supported intervals: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
const TIMEFRAME_INTERVAL: Record<string, string> = {
  [Timeframe.ONE_MINUTE]: "1m",
  [Timeframe.FIVE_MINUTES]: "5m",
  [Timeframe.FIFTEEN_MINUTES]: "15m",
  [Timeframe.ONE_HOUR]: "1h",
  [Timeframe.FOUR_HOURS]: "1h", // Yahoo has no 4h interval; use 1h data
  [Timeframe.ONE_DAY]: "1d",
  [Timeframe.ONE_WEEK]: "1wk",
};

@Injectable()
export class YahooFinanceProvider implements IMarketDataProvider {
  private readonly logger = new Logger(YahooFinanceProvider.name);

  supports(assetClass: AssetClass): boolean {
    return assetClass === AssetClass.STOCK || assetClass === AssetClass.ETF;
  }

  async fetchOhlcv(request: OhlcvRequest): Promise<Ohlcv[]> {
    const interval = TIMEFRAME_INTERVAL[request.timeframe] ?? "1d";
    const period1 = Math.floor(request.startDate.getTime() / 1000);
    const period2 = Math.floor(request.endDate.getTime() / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${request.ticker}?interval=${interval}&period1=${period1}&period2=${period2}`;

    this.logger.log(
      `Fetching Yahoo Finance OHLCV for ${request.ticker} (${interval})`,
    );

    return this.fetchWithRetry(url, request.ticker, request.timeframe, 1);
  }

  private async fetchWithRetry(
    url: string,
    ticker: string,
    timeframe: Timeframe,
    attempt: number,
  ): Promise<Ohlcv[]> {
    await yahooRateLimiter.acquire();

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt < 2) {
          const backoffMs = attempt * 2000;
          this.logger.warn(
            `Yahoo Finance ${response.status} for ${ticker}, retrying in ${backoffMs}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          return this.fetchWithRetry(url, ticker, timeframe, attempt + 1);
        }
        this.logger.warn(
          `Yahoo Finance API returned ${response.status} for ${ticker} after ${attempt} attempts`,
        );
        return [];
      }

      if (!response.ok) {
        this.logger.warn(
          `Yahoo Finance API returned ${response.status} for ${ticker}`,
        );
        return [];
      }

      const json = (await response.json()) as {
        chart?: {
          result?: {
            timestamp?: number[];
            indicators?: {
              quote?: {
                open?: number[];
                high?: number[];
                low?: number[];
                close?: number[];
                volume?: number[];
              }[];
            };
          }[];
        };
      };

      const result = json?.chart?.result?.[0];
      if (!result?.timestamp) return [];

      const timestamps = result.timestamp;
      const quote = result.indicators?.quote?.[0];
      if (!quote) return [];

      const candles: Ohlcv[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const open = quote.open?.[i];
        const high = quote.high?.[i];
        const low = quote.low?.[i];
        const close = quote.close?.[i];
        const volume = quote.volume?.[i] ?? 0;

        if (
          ts &&
          open != null &&
          high != null &&
          low != null &&
          close != null
        ) {
          candles.push(
            new Ohlcv(
              ticker,
              new Date(ts * 1000),
              timeframe,
              open,
              high,
              low,
              close,
              volume,
            ),
          );
        }
      }

      return candles;
    } catch (err) {
      this.logger.error(`Yahoo Finance fetch failed for ${ticker}`, err);
      return [];
    }
  }
}
