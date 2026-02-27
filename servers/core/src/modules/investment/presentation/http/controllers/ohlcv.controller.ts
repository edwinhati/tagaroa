import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { toOhlcvResponse } from "../../../application/dtos/market-data/ohlcv-response.dto";
import { SyncOhlcvDto } from "../../../application/dtos/market-data/sync-ohlcv.dto";
import { GetOhlcvUseCase } from "../../../application/use-cases/market-data/get-ohlcv.use-case";
import { SyncOhlcvUseCase } from "../../../application/use-cases/market-data/sync-ohlcv.use-case";
import type { Timeframe } from "../../../domain/value-objects/timeframe.value-object";

@Controller("investment/ohlcv")
export class OhlcvController {
  constructor(
    private readonly getOhlcvUseCase: GetOhlcvUseCase,
    private readonly syncOhlcvUseCase: SyncOhlcvUseCase,
  ) {}

  @Get(":instrumentId")
  async getOhlcv(
    @Param("instrumentId", ParseUUIDPipe) instrumentId: string,
    @Query("timeframe") timeframe: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("limit") limit?: string,
  ) {
    const candles = await this.getOhlcvUseCase.execute({
      instrumentId,
      timeframe: timeframe as Timeframe,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
    return candles.map(toOhlcvResponse);
  }

  @Post("sync")
  async syncOhlcv(@Body() dto: SyncOhlcvDto) {
    return this.syncOhlcvUseCase.execute(dto);
  }
}
