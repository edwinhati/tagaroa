import type { PaginatedResult } from "../../../../../shared/types/pagination";
import type { AssetClass } from "../../value-objects/asset-class.value-object";
import type { Instrument } from "../entities/instrument.entity";

export const INSTRUMENT_REPOSITORY = Symbol("INSTRUMENT_REPOSITORY");

export type InstrumentFilterParams = {
  search?: string;
  assetClass?: AssetClass;
};

export interface IInstrumentRepository {
  findById(id: string): Promise<Instrument | null>;
  findByTicker(ticker: string): Promise<Instrument | null>;
  findAllPaginated(
    offset: number,
    limit: number,
    filters?: InstrumentFilterParams,
  ): Promise<PaginatedResult<Instrument>>;
  create(instrument: Instrument): Promise<Instrument>;
  update(instrument: Instrument): Promise<Instrument>;
}
