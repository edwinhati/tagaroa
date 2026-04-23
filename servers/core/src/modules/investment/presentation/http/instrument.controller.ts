import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import {
  buildJsonApiResponse,
  buildPaginationInfo,
  parsePaginationParams,
} from "../../../../shared/types/pagination";
import { toInstrumentResponse } from "../../application/dtos/market-data/instrument-response.dto";
import type { RegisterInstrumentDto } from "../../application/dtos/market-data/register-instrument.dto";
import { DeleteInstrumentUseCase } from "../../application/use-cases/market-data/delete-instrument.use-case";
import { GetInstrumentMetadataUseCase } from "../../application/use-cases/market-data/get-instrument-metadata.use-case";
import { ListInstrumentsUseCase } from "../../application/use-cases/market-data/list-instruments.use-case";
import { RegisterInstrumentUseCase } from "../../application/use-cases/market-data/register-instrument.use-case";
import { SearchInstrumentsUseCase } from "../../application/use-cases/market-data/search-instruments.use-case";
import type { AssetClass } from "../../domain/value-objects/asset-class.value-object";

@Controller("investment/instruments")
export class InstrumentController {
  constructor(
    private readonly listInstrumentsUseCase: ListInstrumentsUseCase,
    private readonly registerInstrumentUseCase: RegisterInstrumentUseCase,
    private readonly searchInstrumentsUseCase: SearchInstrumentsUseCase,
    private readonly getInstrumentMetadataUseCase: GetInstrumentMetadataUseCase,
    private readonly deleteInstrumentUseCase: DeleteInstrumentUseCase,
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

  @Get("lookup")
  @AllowAnonymous()
  async lookup(@Query("q") q?: string) {
    if (!q || q.trim().length < 1) return [];
    return this.searchInstrumentsUseCase.execute(q.trim());
  }

  @Post()
  async register(@Body() dto: RegisterInstrumentDto) {
    const instrument = await this.registerInstrumentUseCase.execute(dto);
    return toInstrumentResponse(instrument);
  }

  @Patch(":id/metadata")
  async refreshMetadata(@Param("id") id: string) {
    const metadata = await this.getInstrumentMetadataUseCase.execute(id);
    return { ok: true, metadata };
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string) {
    await this.deleteInstrumentUseCase.execute(id);
  }
}
