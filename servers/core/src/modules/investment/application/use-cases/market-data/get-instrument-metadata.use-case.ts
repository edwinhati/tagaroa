import { Inject, Injectable, Logger } from "@nestjs/common";
import { Instrument } from "../../../domain/market-data/entities/instrument.entity";
import {
  type IInstrumentRepository,
  INSTRUMENT_REPOSITORY,
} from "../../../domain/market-data/repositories/instrument.repository.interface";
import { AssetClass } from "../../../domain/value-objects/asset-class.value-object";

@Injectable()
export class GetInstrumentMetadataUseCase {
  private readonly logger = new Logger(GetInstrumentMetadataUseCase.name);

  @Inject(INSTRUMENT_REPOSITORY)
  private readonly instrumentRepository!: IInstrumentRepository;

  async execute(instrumentId: string): Promise<Record<string, unknown> | null> {
    const instrument = await this.instrumentRepository.findById(instrumentId);
    if (!instrument) return null;

    let freshMetadata: Record<string, unknown> | null = null;

    if (
      instrument.assetClass === AssetClass.STOCK ||
      instrument.assetClass === AssetClass.ETF
    ) {
      freshMetadata = await this.fetchYahooMetadata(instrument.ticker);
    } else if (instrument.assetClass === AssetClass.CRYPTO) {
      freshMetadata = await this.fetchCoinGeckoMetadata(instrument.ticker);
    }

    if (!freshMetadata) return null;

    const merged = { ...(instrument.metadata ?? {}), ...freshMetadata };
    const updated = new Instrument(
      instrument.id,
      instrument.ticker,
      instrument.name,
      instrument.assetClass,
      instrument.exchange,
      instrument.currency,
      merged,
      instrument.createdAt,
      new Date(),
    );

    await this.instrumentRepository.update(updated);
    return merged;
  }

  private async fetchYahooMetadata(
    ticker: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=assetProfile%2CsummaryDetail%2CdefaultKeyStatistics`;
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        this.logger.warn(
          `Yahoo metadata returned ${response.status} for ${ticker}`,
        );
        return null;
      }

      const json = (await response.json()) as {
        quoteSummary?: {
          result?: {
            assetProfile?: {
              sector?: string;
              industry?: string;
              fullTimeEmployees?: number;
              longBusinessSummary?: string;
              country?: string;
              website?: string;
              companyOfficers?: { name: string; title: string }[];
            };
            summaryDetail?: {
              marketCap?: { raw: number };
              trailingPE?: { raw: number };
              dividendYield?: { raw: number };
              beta?: { raw: number };
              previousClose?: { raw: number };
              averageVolume?: { raw: number };
            };
            defaultKeyStatistics?: {
              trailingEps?: { raw: number };
            };
          }[];
        };
      };

      const result = json?.quoteSummary?.result?.[0];
      if (!result) return null;

      const profile = result.assetProfile ?? {};
      const summary = result.summaryDetail ?? {};
      const keyStats = result.defaultKeyStatistics ?? {};

      const ceo =
        profile.companyOfficers?.find(
          (o) =>
            o.title?.toLowerCase().includes("chief executive") ||
            o.title?.toLowerCase().includes("ceo"),
        )?.name ?? null;

      return {
        sector: profile.sector ?? null,
        industry: profile.industry ?? null,
        employees: profile.fullTimeEmployees ?? null,
        ceo,
        description: profile.longBusinessSummary ?? null,
        country: profile.country ?? null,
        website: profile.website ?? null,
        marketCap: summary.marketCap?.raw ?? null,
        peRatio: summary.trailingPE?.raw ?? null,
        eps: keyStats.trailingEps?.raw ?? null,
        dividendYield: summary.dividendYield?.raw ?? null,
        beta: summary.beta?.raw ?? null,
        previousClose: summary.previousClose?.raw ?? null,
        averageVolume: summary.averageVolume?.raw ?? null,
      };
    } catch (err) {
      this.logger.warn(`Yahoo metadata fetch failed for ${ticker}`, err);
      return null;
    }
  }

  private async fetchCoinGeckoMetadata(
    ticker: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const coinId = ticker
        .toLowerCase()
        .replace("/usdt", "")
        .replace("/usd", "");
      const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        this.logger.warn(
          `CoinGecko metadata returned ${response.status} for ${coinId}`,
        );
        return null;
      }

      const json = (await response.json()) as {
        description?: { en?: string };
        market_data?: {
          market_cap?: { usd?: number };
          circulating_supply?: number;
          total_supply?: number;
          max_supply?: number;
          ath?: { usd?: number };
          ath_date?: { usd?: string };
        };
        categories?: string[];
        links?: { homepage?: string[] };
        genesis_date?: string;
      };

      const marketData = json?.market_data ?? {};
      const rawDesc = json?.description?.en ?? null;

      return {
        description: rawDesc
          ? rawDesc
              .replace(/<[^>]*>/g, "")
              .replace(/\s+/g, " ")
              .trim()
          : null,
        marketCap: marketData.market_cap?.usd ?? null,
        circulatingSupply: marketData.circulating_supply ?? null,
        totalSupply: marketData.total_supply ?? null,
        maxSupply: marketData.max_supply ?? null,
        allTimeHigh: marketData.ath?.usd ?? null,
        allTimeHighDate: marketData.ath_date?.usd ?? null,
        category: json?.categories?.[0] ?? null,
        website: json?.links?.homepage?.[0]?.replace(/\/$/, "") ?? null,
        genesisDate: json?.genesis_date ?? null,
      };
    } catch (err) {
      this.logger.warn(`CoinGecko metadata fetch failed for ${ticker}`, err);
      return null;
    }
  }
}
