import { Injectable, Logger } from "@nestjs/common";
import type { OhlcvRequest } from "../../../investment/domain/market-data/interfaces/market-data-provider.interface";
import { AssetClass } from "../../../investment/domain/value-objects/asset-class.value-object";
import { EcbRatesProvider } from "../../../investment/infrastructure/market-data-providers/ecb-rates.provider";

export interface ExchangeRateResult {
  rate: number;
  date: Date;
  source: string;
}

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly BASE_CURRENCY = "USD";

  constructor(private readonly ecbProvider: EcbRatesProvider) {}

  /**
   * Fetch exchange rate from currency to USD
   * ECB rates are quoted as EUR/XXX, so we need to handle conversion carefully
   */
  async getRateToUSD(
    currency: string,
    date: Date,
  ): Promise<ExchangeRateResult> {
    if (currency === this.BASE_CURRENCY) {
      return {
        rate: 1.0,
        date,
        source: "BASE",
      };
    }

    try {
      // ECB provides rates with EUR as base, so we need EUR/XXX
      // For USD, we get EUR/USD rate
      // To convert XXX to USD: amount / EUR_XXX_rate * EUR_USD_rate
      // But for simplicity, we'll fetch USD/XXX if available, or calculate

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
        // Fallback: try direct USD pair
        return this.fetchDirectUSDRate(currency, date);
      }

      const rateToEUR = ohlcv[0].close;
      // Convert: 1 EUR = rateToEUR of currency
      // So 1 currency = 1/rateToEUR EUR
      // We need USD rate, so fetch EUR/USD
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
      // 1 currency = (1/rateToEUR) EUR = (1/rateToEUR) * eurToUsd USD
      const rateToUSD = (1 / rateToEUR) * eurToUsd;

      return {
        rate: rateToUSD,
        date: ohlcv[0].timestamp,
        source: "ECB",
      };
    } catch (error) {
      this.logger.error(`Failed to fetch rate for ${currency}`, error);
      return this.fetchDirectUSDRate(currency, date);
    }
  }

  /**
   * Fetch multiple rates at once (optimized for snapshot creation)
   */
  async getRatesToUSD(
    currencies: string[],
    date: Date,
  ): Promise<Map<string, ExchangeRateResult>> {
    const rates = new Map<string, ExchangeRateResult>();
    const uniqueCurrencies = [...new Set(currencies)];

    // Fetch all rates in parallel
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
      // Try USD/currency format
      const request: OhlcvRequest = {
        ticker: `USD/${currency}`,
        assetClass: AssetClass.FOREX,
        startDate: date,
        endDate: date,
        timeframe: "1d",
      };

      const ohlcv = await this.ecbProvider.fetchOhlcv(request);

      if (ohlcv.length > 0 && ohlcv[0]?.close != null) {
        // Rate is USD per 1 currency unit
        return {
          rate: 1 / ohlcv[0].close,
          date: ohlcv[0].timestamp,
          source: "ECB-DIRECT",
        };
      }

      this.logger.error(`No exchange rate available for ${currency}`);
      // Return identity rate as last resort (1:1)
      return {
        rate: 1.0,
        date,
        source: "FALLBACK-IDENTITY",
      };
    } catch (error) {
      this.logger.error(`Direct rate fetch failed for ${currency}`, error);
      return {
        rate: 1.0,
        date,
        source: "FALLBACK-IDENTITY",
      };
    }
  }
}
