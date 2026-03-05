import { Inject, Injectable } from "@nestjs/common";
import { Asset } from "../../domain/entities/asset.entity";
import {
  AssetAccessDeniedException,
  AssetNotFoundException,
} from "../../domain/exceptions/asset.exceptions";
import type { IAssetRepository } from "../../domain/repositories/asset.repository.interface";
import { ASSET_REPOSITORY } from "../../domain/repositories/asset.repository.interface";
import type { UpdateAssetDto } from "../dtos/update-asset.dto";

@Injectable()
export class UpdateAssetUseCase {
  @Inject(ASSET_REPOSITORY)
  private readonly assetRepository!: IAssetRepository;

  async execute(
    id: string,
    dto: UpdateAssetDto,
    userId: string,
  ): Promise<Asset> {
    const existing = await this.assetRepository.findById(id);

    if (!existing) {
      throw new AssetNotFoundException(id);
    }

    if (existing.userId !== userId) {
      throw new AssetAccessDeniedException();
    }

    const updated = new Asset(
      existing.id,
      existing.userId,
      dto.name ?? existing.name,
      dto.type ?? existing.type,
      dto.value ?? existing.value,
      dto.shares === undefined ? existing.shares : dto.shares,
      dto.ticker === undefined ? existing.ticker : dto.ticker,
      dto.currency ?? existing.currency,
      dto.notes === undefined ? existing.notes : dto.notes,
      existing.deletedAt,
      existing.createdAt,
      new Date(),
      existing.version,
    );

    return this.assetRepository.update(updated);
  }
}
