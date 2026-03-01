import { Inject, Injectable } from "@nestjs/common";
import { InstrumentAlreadyExistsException } from "../../../domain/exceptions/investment.exceptions";
import { Instrument } from "../../../domain/market-data/entities/instrument.entity";
import {
  type IInstrumentRepository,
  INSTRUMENT_REPOSITORY,
} from "../../../domain/market-data/repositories/instrument.repository.interface";
import type { RegisterInstrumentDto } from "../../dtos/market-data/register-instrument.dto";
import { GetInstrumentMetadataUseCase } from "./get-instrument-metadata.use-case";

@Injectable()
export class RegisterInstrumentUseCase {
  constructor(
    @Inject(INSTRUMENT_REPOSITORY)
    private readonly instrumentRepository: IInstrumentRepository,
    private readonly getMetadataUseCase: GetInstrumentMetadataUseCase,
  ) {}

  async execute(dto: RegisterInstrumentDto): Promise<Instrument> {
    const existing = await this.instrumentRepository.findByTicker(dto.ticker);
    if (existing) {
      throw new InstrumentAlreadyExistsException(dto.ticker);
    }

    const now = new Date();
    const instrument = new Instrument(
      crypto.randomUUID(),
      dto.ticker.toUpperCase(),
      dto.name,
      dto.assetClass,
      dto.exchange ?? null,
      dto.currency.toUpperCase(),
      dto.metadata ?? null,
      now,
      now,
    );

    const created = await this.instrumentRepository.create(instrument);

    // Fire-and-forget metadata enrichment — failures do not block registration
    this.getMetadataUseCase.execute(created.id).catch(() => {});

    return created;
  }
}
