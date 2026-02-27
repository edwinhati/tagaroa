import type { Timeframe } from "../../value-objects/timeframe.value-object";

export class Ohlcv {
  constructor(
    public readonly instrumentId: string,
    public readonly timestamp: Date,
    public readonly timeframe: Timeframe,
    public readonly open: number,
    public readonly high: number,
    public readonly low: number,
    public readonly close: number,
    public readonly volume: number,
  ) {}
}
