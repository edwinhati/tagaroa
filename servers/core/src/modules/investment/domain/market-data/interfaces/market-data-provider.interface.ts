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
}
