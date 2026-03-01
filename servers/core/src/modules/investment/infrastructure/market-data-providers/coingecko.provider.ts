import { Injectable, Logger } from "@nestjs/common";
import { Ohlcv } from "../../domain/market-data/entities/ohlcv.entity";
import type {
  IMarketDataProvider,
  OhlcvRequest,
} from "../../domain/market-data/interfaces/market-data-provider.interface";
import { AssetClass } from "../../domain/value-objects/asset-class.value-object";
import { Timeframe } from "../../domain/value-objects/timeframe.value-object";
import { coinGeckoRateLimiter } from "./rate-limiter";

const TIMEFRAME_DAYS: Record<string, number> = {
  [Timeframe.ONE_MINUTE]: 1,
  [Timeframe.FIVE_MINUTES]: 1,
  [Timeframe.FIFTEEN_MINUTES]: 7,
  [Timeframe.ONE_HOUR]: 90,
  [Timeframe.FOUR_HOURS]: 90,
  [Timeframe.ONE_DAY]: 365,
  [Timeframe.ONE_WEEK]: 365,
};

type OhlcRow = [number, number, number, number, number];

@Injectable()
export class CoinGeckoProvider implements IMarketDataProvider {
  private readonly logger = new Logger(CoinGeckoProvider.name);
  private readonly baseUrl = "https://api.coingecko.com/api/v3";

  supports(assetClass: AssetClass): boolean {
    return assetClass === AssetClass.CRYPTO;
  }

  async fetchLatestPrices(tickers: string[]): Promise<Map<string, number>> {
    if (tickers.length === 0) return new Map();

    const coinIds = tickers.map((t) =>
      t.toLowerCase().replace("/usdt", "").replace("/usd", ""),
    );
    const url = `${this.baseUrl}/simple/price?ids=${coinIds.join(",")}&vs_currencies=usd`;

    try {
      await coinGeckoRateLimiter.acquire();
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`CoinGecko simple/price returned ${response.status}`);
        return new Map();
      }
      const data = (await response.json()) as Record<string, { usd?: number }>;
      const result = new Map<string, number>();
      for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        const coinId = coinIds[i];
        const price = coinId ? data[coinId]?.usd : undefined;
        if (ticker && price != null) result.set(ticker, price);
      }
      return result;
    } catch (err) {
      this.logger.error("CoinGecko fetchLatestPrices failed", err);
      return new Map();
    }
  }

  async fetchOhlcv(request: OhlcvRequest): Promise<Ohlcv[]> {
    const days = TIMEFRAME_DAYS[request.timeframe] ?? 30;
    const coinId = request.ticker
      .toLowerCase()
      .replace("/usdt", "")
      .replace("/usd", "");

    this.logger.log(`Fetching CoinGecko OHLCV for ${coinId} (${days} days)`);

    const url = `${this.baseUrl}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;

    return this.fetchWithRetry(url, coinId, request, 1);
  }

  private parseResponse(raw: unknown, request: OhlcvRequest): Ohlcv[] {
    const data = raw as OhlcRow[];
    return data
      .filter(([ts]) => {
        const date = new Date(ts);
        return date >= request.startDate && date <= request.endDate;
      })
      .map(([ts, open, high, low, close]) => {
        return new Ohlcv(
          request.ticker,
          new Date(ts),
          request.timeframe,
          open,
          high,
          low,
          close,
          0, // CoinGecko OHLC endpoint doesn't include volume
        );
      });
  }

  private async fetchWithRetry(
    url: string,
    coinId: string,
    request: OhlcvRequest,
    attempt: number,
  ): Promise<Ohlcv[]> {
    await coinGeckoRateLimiter.acquire();

    try {
      const response = await fetch(url);

      if (response.status === 429 || response.status >= 500) {
        if (attempt < 2) {
          const backoffMs = attempt * 2000;
          this.logger.warn(
            `CoinGecko ${response.status} for ${coinId}, retrying in ${backoffMs}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          return this.fetchWithRetry(url, coinId, request, attempt + 1);
        }
        this.logger.warn(
          `CoinGecko API returned ${response.status} for ${coinId} after ${attempt} attempts`,
        );
        return [];
      }

      if (!response.ok) {
        this.logger.warn(
          `CoinGecko API returned ${response.status} for ${coinId}`,
        );
        return [];
      }

      const data = await response.json();
      return this.parseResponse(data, request);
    } catch (err) {
      this.logger.error(`CoinGecko fetch failed for ${coinId}`, err);
      return [];
    }
  }
}
