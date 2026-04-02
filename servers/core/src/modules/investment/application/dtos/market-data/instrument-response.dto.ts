import type { Instrument } from "../../../domain/market-data/entities/instrument.entity";

type InstrumentResponseDto = {
  id: string;
  ticker: string;
  name: string;
  asset_class: string;
  exchange: string | null;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
};

export function toInstrumentResponse(
  instrument: Instrument,
): InstrumentResponseDto {
  return {
    id: instrument.id,
    ticker: instrument.ticker,
    name: instrument.name,
    asset_class: instrument.assetClass,
    exchange: instrument.exchange,
    currency: instrument.currency,
    metadata: instrument.metadata,
    created_at: instrument.createdAt,
    updated_at: instrument.updatedAt,
  };
}
