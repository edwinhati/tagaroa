import type { Timeframe } from "../../value-objects/timeframe.value-object";
import type { Ohlcv } from "../entities/ohlcv.entity";

export const OHLCV_REPOSITORY = Symbol("OHLCV_REPOSITORY");

export interface OhlcvQueryParams {
  instrumentId: string;
  timeframe: Timeframe;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface IOhlcvRepository {
  findMany(params: OhlcvQueryParams): Promise<Ohlcv[]>;
  upsertMany(candles: Ohlcv[]): Promise<void>;
  findLatest(instrumentId: string, timeframe: Timeframe): Promise<Ohlcv | null>;
}
