import { Inject, Injectable } from "@nestjs/common";
import { InstrumentNotFoundException } from "../../../domain/exceptions/investment.exceptions";
import type { Ohlcv } from "../../../domain/market-data/entities/ohlcv.entity";
import {
  type IInstrumentRepository,
  INSTRUMENT_REPOSITORY,
} from "../../../domain/market-data/repositories/instrument.repository.interface";
import {
  type IOhlcvRepository,
  OHLCV_REPOSITORY,
} from "../../../domain/market-data/repositories/ohlcv.repository.interface";
import type { Timeframe } from "../../../domain/value-objects/timeframe.value-object";

interface GetOhlcvParams {
  instrumentId: string;
  timeframe: Timeframe;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

@Injectable()
export class GetOhlcvUseCase {
  constructor(
    @Inject(INSTRUMENT_REPOSITORY)
    private readonly instrumentRepository: IInstrumentRepository,
    @Inject(OHLCV_REPOSITORY)
    private readonly ohlcvRepository: IOhlcvRepository,
  ) {}

  async execute(params: GetOhlcvParams): Promise<Ohlcv[]> {
    const instrument = await this.instrumentRepository.findById(
      params.instrumentId,
    );
    if (!instrument) {
      throw new InstrumentNotFoundException(params.instrumentId);
    }

    return this.ohlcvRepository.findMany({
      instrumentId: params.instrumentId,
      timeframe: params.timeframe,
      startDate: params.startDate,
      endDate: params.endDate,
      limit: params.limit,
    });
  }
}
