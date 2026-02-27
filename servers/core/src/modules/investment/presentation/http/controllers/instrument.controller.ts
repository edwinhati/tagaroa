import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import {
  buildJsonApiResponse,
  buildPaginationInfo,
  parsePaginationParams,
} from "../../../../../shared/types/pagination";
import { toInstrumentResponse } from "../../../application/dtos/market-data/instrument-response.dto";
import { RegisterInstrumentDto } from "../../../application/dtos/market-data/register-instrument.dto";
import { ListInstrumentsUseCase } from "../../../application/use-cases/market-data/list-instruments.use-case";
import { RegisterInstrumentUseCase } from "../../../application/use-cases/market-data/register-instrument.use-case";
import type { AssetClass } from "../../../domain/value-objects/asset-class.value-object";

@Controller("investment/instruments")
export class InstrumentController {
  constructor(
    private readonly listInstrumentsUseCase: ListInstrumentsUseCase,
    private readonly registerInstrumentUseCase: RegisterInstrumentUseCase,
  ) {}

  @Get()
  @AllowAnonymous()
  async list(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("assetClass") assetClass?: string,
  ) {
    const pagination = parsePaginationParams({ page, limit });
    const result = await this.listInstrumentsUseCase.execute(pagination, {
      search: search || undefined,
      assetClass: assetClass as AssetClass | undefined,
    });
    const data = result.items.map(toInstrumentResponse);
    const paginationInfo = buildPaginationInfo(
      pagination.page,
      pagination.limit,
      result.total,
    );
    return buildJsonApiResponse(data, paginationInfo);
  }

  @Post()
  async register(@Body() dto: RegisterInstrumentDto) {
    const instrument = await this.registerInstrumentUseCase.execute(dto);
    return toInstrumentResponse(instrument);
  }
}
