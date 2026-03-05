import { Injectable, Logger } from "@nestjs/common";
import { AssetClass } from "../../../domain/value-objects/asset-class.value-object";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type InstrumentLookupResult = {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  exchange: string | null;
  currency: string;
  source: "yahoo" | "coingecko";
};

// ---------------------------------------------------------------------------
// Yahoo Finance type mappings
// ---------------------------------------------------------------------------

const YAHOO_QUOTE_TYPE_MAP: Record<string, AssetClass | null> = {
  EQUITY: AssetClass.STOCK,
  ETF: AssetClass.ETF,
  CURRENCY: AssetClass.FOREX,
  CRYPTOCURRENCY: AssetClass.CRYPTO,
  FUTURE: AssetClass.COMMODITY,
};

// ---------------------------------------------------------------------------
// Use case
// ---------------------------------------------------------------------------

@Injectable()
export class SearchInstrumentsUseCase {
  private readonly logger = new Logger(SearchInstrumentsUseCase.name);

  async execute(query: string): Promise<InstrumentLookupResult[]> {
    const [yahooResult, coingeckoResult] = await Promise.allSettled([
      this.searchYahoo(query),
      this.searchCoinGecko(query),
    ]);

    const results: InstrumentLookupResult[] = [];

    if (yahooResult.status === "fulfilled") {
      results.push(...yahooResult.value);
    } else {
      this.logger.warn("Yahoo Finance search failed", yahooResult.reason);
    }

    if (coingeckoResult.status === "fulfilled") {
      results.push(...coingeckoResult.value);
    } else {
      this.logger.warn("CoinGecko search failed", coingeckoResult.reason);
    }

    // Deduplicate by ticker (case-insensitive), Yahoo takes priority
    const seen = new Set<string>();
    return results.filter((r) => {
      const key = r.ticker.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ── Yahoo Finance autocomplete ──────────────────────────────────────────

  private async searchYahoo(query: string): Promise<InstrumentLookupResult[]> {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&enableNavLinks=false`;

    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      this.logger.warn(`Yahoo search returned ${response.status}`);
      return [];
    }

    const json = (await response.json()) as {
      quotes?: {
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchDisp?: string;
        quoteType?: string;
        currency?: string;
      }[];
    };

    const quotes = json?.quotes ?? [];

    return quotes
      .filter((q) => q.symbol && q.quoteType)
      .flatMap((q) => {
        const assetClass =
          YAHOO_QUOTE_TYPE_MAP[q.quoteType?.toUpperCase() ?? ""] ?? null;
        if (!assetClass) return [];

        const symbol = q.symbol;
        if (!symbol) return [];

        return [
          {
            ticker: symbol.toUpperCase(),
            name: q.longname ?? q.shortname ?? symbol ?? "",
            assetClass,
            exchange: q.exchDisp ?? null,
            currency: q.currency ?? "USD",
            source: "yahoo" as const,
          },
        ];
      });
  }

  // ── CoinGecko search ────────────────────────────────────────────────────

  private async searchCoinGecko(
    query: string,
  ): Promise<InstrumentLookupResult[]> {
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      this.logger.warn(`CoinGecko search returned ${response.status}`);
      return [];
    }

    const json = (await response.json()) as {
      coins?: { id: string; name: string; symbol: string }[];
    };

    return (json?.coins ?? []).slice(0, 8).map((c) => ({
      ticker: c.symbol.toUpperCase(),
      name: c.name,
      assetClass: AssetClass.CRYPTO,
      exchange: null,
      currency: "USD",
      source: "coingecko" as const,
    }));
  }
}
