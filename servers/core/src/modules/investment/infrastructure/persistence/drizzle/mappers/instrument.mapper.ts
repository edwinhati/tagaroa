import type { InferSelectModel } from "drizzle-orm";
import { Instrument } from "../../../../domain/market-data/entities/instrument.entity";
import type { AssetClass } from "../../../../domain/value-objects/asset-class.value-object";
import type { instruments } from "../schemas/instrument.schema";

type InstrumentRow = InferSelectModel<typeof instruments>;

function mapInstrumentToDomain(row: InstrumentRow): Instrument {
  return new Instrument(
    row.id,
    row.ticker,
    row.name,
    row.assetClass as AssetClass,
    row.exchange ?? null,
    row.currency,
    row.metadata as Record<string, unknown> | null,
    row.createdAt ?? new Date(),
    row.updatedAt ?? new Date(),
  );
}

function mapInstrumentToPersistence(
  entity: Instrument,
): Omit<InstrumentRow, "createdAt" | "updatedAt"> {
  return {
    id: entity.id,
    ticker: entity.ticker,
    name: entity.name,
    assetClass: entity.assetClass,
    exchange: entity.exchange,
    currency: entity.currency,
    metadata: entity.metadata,
  };
}

export const InstrumentMapper = {
  toDomain: mapInstrumentToDomain,
  toPersistence: mapInstrumentToPersistence,
};
