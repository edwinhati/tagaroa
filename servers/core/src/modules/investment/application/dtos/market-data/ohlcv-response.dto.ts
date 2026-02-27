import type { Ohlcv } from "../../../domain/market-data/entities/ohlcv.entity";

export type OhlcvResponseDto = {
  instrument_id: string;
  timestamp: Date;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function toOhlcvResponse(ohlcv: Ohlcv): OhlcvResponseDto {
  return {
    instrument_id: ohlcv.instrumentId,
    timestamp: ohlcv.timestamp,
    timeframe: ohlcv.timeframe,
    open: ohlcv.open,
    high: ohlcv.high,
    low: ohlcv.low,
    close: ohlcv.close,
    volume: ohlcv.volume,
  };
}
