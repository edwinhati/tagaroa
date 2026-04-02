import type { InferSelectModel } from "drizzle-orm";
import { Ohlcv } from "../../../../domain/market-data/entities/ohlcv.entity";
import type { Timeframe } from "../../../../domain/value-objects/timeframe.value-object";
import type { ohlcv } from "../schemas/ohlcv.schema";

type OhlcvRow = InferSelectModel<typeof ohlcv>;

function mapOhlcvToDomain(row: OhlcvRow): Ohlcv {
  return new Ohlcv(
    row.instrumentId,
    row.timestamp,
    row.timeframe as Timeframe,
    Number(row.open),
    Number(row.high),
    Number(row.low),
    Number(row.close),
    Number(row.volume),
  );
}

function mapOhlcvToPersistence(entity: Ohlcv): OhlcvRow {
  return {
    instrumentId: entity.instrumentId,
    timestamp: entity.timestamp,
    timeframe: entity.timeframe,
    open: String(entity.open),
    high: String(entity.high),
    low: String(entity.low),
    close: String(entity.close),
    volume: String(entity.volume),
  };
}

export const OhlcvMapper = {
  toDomain: mapOhlcvToDomain,
  toPersistence: mapOhlcvToPersistence,
};
