import { Injectable, Logger } from "@nestjs/common";
import { Ohlcv } from "../../domain/market-data/entities/ohlcv.entity";
import type {
  IMarketDataProvider,
  OhlcvRequest,
} from "../../domain/market-data/interfaces/market-data-provider.interface";
import { AssetClass } from "../../domain/value-objects/asset-class.value-object";
import { ecbRateLimiter } from "./rate-limiter";

@Injectable()
export class EcbRatesProvider implements IMarketDataProvider {
  private readonly logger = new Logger(EcbRatesProvider.name);
  private readonly baseUrl = "https://data-api.ecb.europa.eu/service/data/EXR";

  supports(assetClass: AssetClass): boolean {
    return assetClass === AssetClass.FOREX;
  }

  async fetchOhlcv(request: OhlcvRequest): Promise<Ohlcv[]> {
    // Parse ticker like "EUR/USD" → ECB uses base EUR, so we swap
    const parts = request.ticker.split("/");
    const baseCurrency = parts[0] ?? "EUR";
    const quoteCurrency = parts[1] ?? "USD";

    const startPeriod = request.startDate.toISOString().split("T")[0];
    const endPeriod = request.endDate.toISOString().split("T")[0];

    const seriesKey = `D.${quoteCurrency}.${baseCurrency}.SP00.A`;
    const url = `${this.baseUrl}/${seriesKey}?startPeriod=${startPeriod}&endPeriod=${endPeriod}&format=jsondata`;

    this.logger.log(`Fetching ECB rates for ${request.ticker}`);

    try {
      await ecbRateLimiter.acquire();
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        this.logger.warn(
          `ECB API returned ${response.status} for ${request.ticker}`,
        );
        return [];
      }

      const json = (await response.json()) as {
        dataSets?: {
          series?: Record<string, { observations?: Record<string, [number]> }>;
        }[];
        structure?: {
          dimensions?: {
            observation?: { values?: { id: string; name: string }[] }[];
          };
        };
      };

      const dataSet = json?.dataSets?.[0];
      const seriesData = dataSet?.series?.["0:0:0:0:0"];
      const observations = seriesData?.observations;
      const timeDimension =
        json?.structure?.dimensions?.observation?.[0]?.values;

      if (!observations || !timeDimension) return [];

      return Object.entries(observations)
        .map(([idx, [rate]]) => {
          const periodStr = timeDimension[Number(idx)]?.id;
          if (!periodStr || rate == null) return null;
          const ts = new Date(periodStr);
          return new Ohlcv(
            request.ticker,
            ts,
            request.timeframe,
            rate,
            rate,
            rate,
            rate,
            0,
          );
        })
        .filter((c): c is Ohlcv => c !== null);
    } catch (err) {
      this.logger.error(`ECB fetch failed for ${request.ticker}`, err);
      return [];
    }
  }
}
