import { Inject, Injectable } from "@nestjs/common";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../../../../shared/types/pagination";
import type { Instrument } from "../../../domain/market-data/entities/instrument.entity";
import {
  type IInstrumentRepository,
  INSTRUMENT_REPOSITORY,
  type InstrumentFilterParams,
} from "../../../domain/market-data/repositories/instrument.repository.interface";

@Injectable()
export class ListInstrumentsUseCase {
  constructor(
    @Inject(INSTRUMENT_REPOSITORY)
    private readonly instrumentRepository: IInstrumentRepository,
  ) {}

  async execute(
    pagination: PaginationParams,
    filters?: InstrumentFilterParams,
  ): Promise<PaginatedResult<Instrument>> {
    const offset = (pagination.page - 1) * pagination.limit;
    return this.instrumentRepository.findAllPaginated(
      offset,
      pagination.limit,
      filters,
    );
  }
}
