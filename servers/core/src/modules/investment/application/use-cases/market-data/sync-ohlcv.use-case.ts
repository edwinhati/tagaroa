import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  InstrumentNotFoundException,
  MarketDataProviderException,
} from "../../../domain/exceptions/investment.exceptions";
import { Ohlcv } from "../../../domain/market-data/entities/ohlcv.entity";
import {
  type IMarketDataProvider,
  MARKET_DATA_PROVIDER,
} from "../../../domain/market-data/interfaces/market-data-provider.interface";
import {
  type IInstrumentRepository,
  INSTRUMENT_REPOSITORY,
} from "../../../domain/market-data/repositories/instrument.repository.interface";
import {
  type IOhlcvRepository,
  OHLCV_REPOSITORY,
} from "../../../domain/market-data/repositories/ohlcv.repository.interface";
import type { SyncOhlcvDto } from "../../dtos/market-data/sync-ohlcv.dto";

@Injectable()
export class SyncOhlcvUseCase {
  private readonly logger = new Logger(SyncOhlcvUseCase.name);

  constructor(
    @Inject(INSTRUMENT_REPOSITORY)
    private readonly instrumentRepository: IInstrumentRepository,
    @Inject(OHLCV_REPOSITORY)
    private readonly ohlcvRepository: IOhlcvRepository,
    @Inject(MARKET_DATA_PROVIDER)
    private readonly providers: IMarketDataProvider[],
  ) {}

  async execute(dto: SyncOhlcvDto): Promise<{ synced: number }> {
    const instrument = await this.instrumentRepository.findById(
      dto.instrumentId,
    );
    if (!instrument) {
      throw new InstrumentNotFoundException(dto.instrumentId);
    }

    const provider = this.providers.find((p) =>
      p.supports(instrument.assetClass),
    );
    if (!provider) {
      throw new MarketDataProviderException(
        `No provider available for asset class '${instrument.assetClass}'`,
      );
    }

    this.logger.log(
      `Syncing OHLCV for ${instrument.ticker} (${dto.timeframe}) from ${dto.startDate} to ${dto.endDate}`,
    );

    const rawCandles = await provider.fetchOhlcv({
      ticker: instrument.ticker,
      assetClass: instrument.assetClass,
      timeframe: dto.timeframe,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    });

    // Providers only know the ticker; remap to the instrument UUID before persisting.
    // Validate candle data integrity before insert.
    const candles = rawCandles
      .filter((c) => {
        const open = c.open;
        const high = c.high;
        const low = c.low;
        const close = c.close;
        if (open <= 0 || high <= 0 || low <= 0 || close <= 0) return false;
        if (high < Math.max(open, close)) return false;
        if (low > Math.min(open, close)) return false;
        return true;
      })
      .map(
        (c) =>
          new Ohlcv(
            instrument.id,
            c.timestamp,
            c.timeframe,
            c.open,
            c.high,
            c.low,
            c.close,
            c.volume,
          ),
      );

    const skipped = rawCandles.length - candles.length;
    if (skipped > 0) {
      this.logger.warn(
        `Skipped ${skipped} invalid candles for ${instrument.ticker}`,
      );
    }

    if (candles.length > 0) {
      await this.ohlcvRepository.upsertMany(candles);
    }

    this.logger.log(
      `Synced ${candles.length} candles for ${instrument.ticker}`,
    );
    return { synced: candles.length };
  }
}
