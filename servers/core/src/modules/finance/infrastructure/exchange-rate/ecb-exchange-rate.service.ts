import { Injectable, Logger } from "@nestjs/common";
import type { OhlcvRequest } from "../../../investment/domain/market-data/interfaces/market-data-provider.interface";
import { AssetClass } from "../../../investment/domain/value-objects/asset-class.value-object";
import { EcbRatesProvider } from "../../../investment/infrastructure/market-data-providers/ecb-rates.provider";
import type {
  ExchangeRateResult,
  IExchangeRateService,
} from "../../domain/services/exchange-rate.service.interface";

@Injectable()
export class EcbExchangeRateService implements IExchangeRateService {
  private readonly logger = new Logger(EcbExchangeRateService.name);
  private readonly BASE_CURRENCY = "USD";

  constructor(private readonly ecbProvider: EcbRatesProvider) {}

  /**
   * Fetch exchange rate from currency to USD.
   * ECB rates are quoted as EUR/XXX, so we need to handle conversion carefully.
   */
  async getRateToUSD(
    currency: string,
    date: Date,
  ): Promise<ExchangeRateResult> {
    if (currency === this.BASE_CURRENCY) {
      return { rate: 1, date, source: "BASE" };
    }

    try {
      const request: OhlcvRequest = {
        ticker: `EUR/${currency}`,
        assetClass: AssetClass.FOREX,
        startDate: date,
        endDate: date,
        timeframe: "1d",
      };

      const ohlcv = await this.ecbProvider.fetchOhlcv(request);

      if (ohlcv.length === 0 || ohlcv[0]?.close == null) {
        this.logger.warn(
          `No ECB rate found for ${currency} on ${date.toISOString()}`,
        );
        return this.fetchDirectUSDRate(currency, date);
      }

      const rateToEUR = ohlcv[0].close;

      const usdRequest: OhlcvRequest = {
        ticker: "EUR/USD",
        assetClass: AssetClass.FOREX,
        startDate: date,
        endDate: date,
        timeframe: "1d",
      };

      const usdOhlcv = await this.ecbProvider.fetchOhlcv(usdRequest);

      if (usdOhlcv.length === 0 || usdOhlcv[0]?.close == null) {
        this.logger.warn("No EUR/USD rate found");
        return this.fetchDirectUSDRate(currency, date);
      }

      const eurToUsd = usdOhlcv[0].close;
      const rateToUSD = (1 / rateToEUR) * eurToUsd;

      return { rate: rateToUSD, date: ohlcv[0].timestamp, source: "ECB" };
    } catch (error) {
      this.logger.error(`Failed to fetch rate for ${currency}`, error);
      return this.fetchDirectUSDRate(currency, date);
    }
  }

  /**
   * Fetch multiple rates at once (optimised for snapshot creation).
   */
  async getRatesToUSD(
    currencies: string[],
    date: Date,
  ): Promise<Map<string, ExchangeRateResult>> {
    const rates = new Map<string, ExchangeRateResult>();
    const uniqueCurrencies = [...new Set(currencies)];

    const results = await Promise.all(
      uniqueCurrencies.map(async (currency) => {
        const rate = await this.getRateToUSD(currency, date);
        return { currency, rate };
      }),
    );

    for (const { currency, rate } of results) {
      rates.set(currency, rate);
    }

    return rates;
  }

  private async fetchDirectUSDRate(
    currency: string,
    date: Date,
  ): Promise<ExchangeRateResult> {
    try {
      const request: OhlcvRequest = {
        ticker: `USD/${currency}`,
        assetClass: AssetClass.FOREX,
        startDate: date,
        endDate: date,
        timeframe: "1d",
      };

      const ohlcv = await this.ecbProvider.fetchOhlcv(request);

      if (ohlcv.length > 0 && ohlcv[0]?.close != null) {
        return {
          rate: 1 / ohlcv[0].close,
          date: ohlcv[0].timestamp,
          source: "ECB-DIRECT",
        };
      }

      this.logger.error(`No exchange rate available for ${currency}`);
      return { rate: 1, date, source: "FALLBACK-IDENTITY" };
    } catch (error) {
      this.logger.error(`Direct rate fetch failed for ${currency}`, error);
      return { rate: 1, date, source: "FALLBACK-IDENTITY" };
    }
  }
}
