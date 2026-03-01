import type { AssetClass } from "../../value-objects/asset-class.value-object";
import type { Timeframe } from "../../value-objects/timeframe.value-object";
import type { Ohlcv } from "../entities/ohlcv.entity";

export const MARKET_DATA_PROVIDER = Symbol("MARKET_DATA_PROVIDER");

export interface OhlcvRequest {
  ticker: string;
  assetClass: AssetClass;
  timeframe: Timeframe;
  startDate: Date;
  endDate: Date;
}

export interface IMarketDataProvider {
  supports(assetClass: AssetClass): boolean;
  fetchOhlcv(request: OhlcvRequest): Promise<Ohlcv[]>;
  /** Fetch current market prices for a batch of tickers. Optional — providers that
   *  don't implement this will fall back to the latest OHLCV candle from the DB. */
  fetchLatestPrices?(tickers: string[]): Promise<Map<string, number>>;
}
