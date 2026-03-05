import { Inject, Injectable, Logger } from "@nestjs/common";
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

@Injectable()
export class GetLatestPricesUseCase {
  private readonly logger = new Logger(GetLatestPricesUseCase.name);

  @Inject(INSTRUMENT_REPOSITORY)
  private readonly instrumentRepository!: IInstrumentRepository;
  @Inject(OHLCV_REPOSITORY)
  private readonly ohlcvRepository!: IOhlcvRepository;
  @Inject(MARKET_DATA_PROVIDER)
  private readonly providers!: IMarketDataProvider[];

  async execute(
    instrumentIds: string[],
  ): Promise<Record<string, number | null>> {
    if (instrumentIds.length === 0) return {};

    // 1. Fetch all instruments so we know their tickers and asset classes
    const instruments = await Promise.all(
      instrumentIds.map((id) => this.instrumentRepository.findById(id)),
    );

    // 2. Group tickers by provider (via assetClass)
    const result = new Map<string, number | null>(
      instrumentIds.map((id) => [id, null]),
    );

    // Build: provider → [(instrumentId, ticker)]
    const providerBuckets = new Map<
      IMarketDataProvider,
      { id: string; ticker: string }[]
    >();

    for (const instrument of instruments) {
      if (!instrument?.id) continue;
      const provider = this.providers.find((p) =>
        p.supports(instrument.assetClass),
      );
      if (!provider?.fetchLatestPrices) continue;

      const bucket = providerBuckets.get(provider) ?? [];
      bucket.push({ id: instrument.id, ticker: instrument.ticker });
      providerBuckets.set(provider, bucket);
    }

    // 3. Fetch live prices from each provider in parallel
    await Promise.all(
      Array.from(providerBuckets.entries()).map(async ([provider, entries]) => {
        const tickers = entries.map((e) => e.ticker);
        try {
          const prices = await provider.fetchLatestPrices?.(tickers);
          for (const { id, ticker } of entries) {
            const price = prices?.get(ticker);
            if (price != null) result.set(id, price);
          }
        } catch (err) {
          this.logger.warn(`Live price fetch failed: ${err}`);
        }
      }),
    );

    // 4. DB fallback for any instruments whose provider doesn't support live prices
    //    or where the live fetch returned nothing
    const stillMissing = instrumentIds.filter((id) => result.get(id) == null);
    if (stillMissing.length > 0) {
      const dbPrices = await this.ohlcvRepository.findLatestBatch(stillMissing);
      for (const id of stillMissing) {
        result.set(id, dbPrices.get(id) ?? null);
      }
    }

    return Object.fromEntries(result);
  }
}
