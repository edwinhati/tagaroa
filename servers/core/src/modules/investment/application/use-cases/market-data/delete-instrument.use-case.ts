import { Inject, Injectable } from "@nestjs/common";
import { InstrumentNotFoundException } from "../../../domain/exceptions/investment.exceptions";
import {
  type IInstrumentRepository,
  INSTRUMENT_REPOSITORY,
} from "../../../domain/market-data/repositories/instrument.repository.interface";

@Injectable()
export class DeleteInstrumentUseCase {
  constructor(
    @Inject(INSTRUMENT_REPOSITORY)
    private readonly instrumentRepository: IInstrumentRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.instrumentRepository.findById(id);
    if (!existing) {
      throw new InstrumentNotFoundException(id);
    }
    await this.instrumentRepository.delete(id);
  }
}
