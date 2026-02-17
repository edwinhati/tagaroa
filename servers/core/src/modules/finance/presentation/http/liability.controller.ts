import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";
import {
  buildJsonApiResponse,
  buildPaginationInfo,
  parsePaginationParams,
} from "../../../../shared/types/pagination";
import { CreateLiabilityDto } from "../../application/dtos/create-liability.dto";
import {
  type LiabilityResponseDto,
  toLiabilityResponse,
} from "../../application/dtos/liability-response.dto";
import { UpdateLiabilityDto } from "../../application/dtos/update-liability.dto";
import { CreateLiabilityUseCase } from "../../application/use-cases/create-liability.use-case";
import { DeleteLiabilityUseCase } from "../../application/use-cases/delete-liability.use-case";
import { GetLiabilitiesUseCase } from "../../application/use-cases/get-liabilities.use-case";
import { GetLiabilityUseCase } from "../../application/use-cases/get-liability.use-case";
import { UpdateLiabilityUseCase } from "../../application/use-cases/update-liability.use-case";
import { LiabilityType } from "../../domain/value-objects/liability-type";

@Controller("finance/liabilities")
export class LiabilityController {
  constructor(
    private readonly createLiabilityUseCase: CreateLiabilityUseCase,
    private readonly getLiabilitiesUseCase: GetLiabilitiesUseCase,
    private readonly getLiabilityUseCase: GetLiabilityUseCase,
    private readonly updateLiabilityUseCase: UpdateLiabilityUseCase,
    private readonly deleteLiabilityUseCase: DeleteLiabilityUseCase,
  ) {}

  @Get("types")
  @AllowAnonymous()
  getLiabilityTypes() {
    return Object.values(LiabilityType);
  }

  @Get()
  async getLiabilities(
    @Session() session: UserSession,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("type") type?: string,
    @Query("currency") currency?: string,
    @Query("includePaid") includePaid?: string,
  ) {
    const pagination = parsePaginationParams({ page, limit });
    const filters = {
      search: search || undefined,
      types: type
        ? type
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      currencies: currency
        ? currency
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
        : undefined,
      includePaid: includePaid === "true",
    };
    const result = await this.getLiabilitiesUseCase.execute(
      session.user.id,
      pagination,
      filters,
    );
    const data = result.items.map(toLiabilityResponse);
    const paginationInfo = buildPaginationInfo(
      pagination.page,
      pagination.limit,
      result.total,
    );
    return buildJsonApiResponse(data, paginationInfo, result.aggregations);
  }

  @Post()
  async createLiability(
    @Session() session: UserSession,
    @Body() dto: CreateLiabilityDto,
  ): Promise<LiabilityResponseDto> {
    const liability = await this.createLiabilityUseCase.execute(
      dto,
      session.user.id,
    );
    return toLiabilityResponse(liability);
  }

  @Get(":id")
  async getLiability(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ): Promise<LiabilityResponseDto> {
    const liability = await this.getLiabilityUseCase.execute(
      id,
      session.user.id,
    );
    return toLiabilityResponse(liability);
  }

  @Patch(":id")
  async updateLiability(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
    @Body() dto: UpdateLiabilityDto,
  ): Promise<LiabilityResponseDto> {
    const liability = await this.updateLiabilityUseCase.execute(
      id,
      dto,
      session.user.id,
    );
    return toLiabilityResponse(liability);
  }

  @Delete(":id")
  async deleteLiability(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    await this.deleteLiabilityUseCase.execute(id, session.user.id);
    return { message: "Liability deleted successfully" };
  }
}
