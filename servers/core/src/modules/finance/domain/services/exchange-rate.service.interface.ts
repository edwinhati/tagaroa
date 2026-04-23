export const EXCHANGE_RATE_SERVICE = Symbol("EXCHANGE_RATE_SERVICE");

export interface ExchangeRateResult {
  rate: number;
  date: Date;
  source: string;
}

export interface IExchangeRateService {
  getRateToUSD(currency: string, date: Date): Promise<ExchangeRateResult>;
  getRatesToUSD(
    currencies: string[],
    date: Date,
  ): Promise<Map<string, ExchangeRateResult>>;
}
