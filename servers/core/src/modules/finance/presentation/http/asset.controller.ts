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
import {
  type AssetResponseDto,
  toAssetResponse,
} from "../../application/dtos/asset-response.dto";
import type { CreateAssetDto } from "../../application/dtos/create-asset.dto";
import type { UpdateAssetDto } from "../../application/dtos/update-asset.dto";
import { CreateAssetUseCase } from "../../application/use-cases/create-asset.use-case";
import { DeleteAssetUseCase } from "../../application/use-cases/delete-asset.use-case";
import { GetAssetUseCase } from "../../application/use-cases/get-asset.use-case";
import { GetAssetsUseCase } from "../../application/use-cases/get-assets.use-case";
import { UpdateAssetUseCase } from "../../application/use-cases/update-asset.use-case";
import { AssetType } from "../../domain/value-objects/asset-type";

@Controller("finance/assets")
export class AssetController {
  constructor(
    private readonly createAssetUseCase: CreateAssetUseCase,
    private readonly getAssetsUseCase: GetAssetsUseCase,
    private readonly getAssetUseCase: GetAssetUseCase,
    private readonly updateAssetUseCase: UpdateAssetUseCase,
    private readonly deleteAssetUseCase: DeleteAssetUseCase,
  ) {}

  @Get("types")
  @AllowAnonymous()
  getAssetTypes() {
    return Object.values(AssetType);
  }

  @Get()
  async getAssets(
    @Session() session: UserSession,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("type") type?: string,
    @Query("currency") currency?: string,
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
    };
    const result = await this.getAssetsUseCase.execute(
      session.user.id,
      pagination,
      filters,
    );
    const data = result.items.map(toAssetResponse);
    const paginationInfo = buildPaginationInfo(
      pagination.page,
      pagination.limit,
      result.total,
    );
    return buildJsonApiResponse(data, paginationInfo, result.aggregations);
  }

  @Post()
  async createAsset(
    @Session() session: UserSession,
    @Body() dto: CreateAssetDto,
  ): Promise<AssetResponseDto> {
    const asset = await this.createAssetUseCase.execute(dto, session.user.id);
    return toAssetResponse(asset);
  }

  @Get(":id")
  async getAsset(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ): Promise<AssetResponseDto> {
    const asset = await this.getAssetUseCase.execute(id, session.user.id);
    return toAssetResponse(asset);
  }

  @Patch(":id")
  async updateAsset(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
    @Body() dto: UpdateAssetDto,
  ): Promise<AssetResponseDto> {
    const asset = await this.updateAssetUseCase.execute(
      id,
      dto,
      session.user.id,
    );
    return toAssetResponse(asset);
  }

  @Delete(":id")
  async deleteAsset(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    await this.deleteAssetUseCase.execute(id, session.user.id);
    return { message: "Asset deleted successfully" };
  }
}
