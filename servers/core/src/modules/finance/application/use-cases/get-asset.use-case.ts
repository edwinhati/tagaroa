import { Inject, Injectable } from "@nestjs/common";
import type { Asset } from "../../domain/entities/asset.entity";
import {
  AssetAccessDeniedException,
  AssetNotFoundException,
} from "../../domain/exceptions/asset.exceptions";
import type { IAssetRepository } from "../../domain/repositories/asset.repository.interface";
import { ASSET_REPOSITORY } from "../../domain/repositories/asset.repository.interface";

@Injectable()
export class GetAssetUseCase {
  @Inject(ASSET_REPOSITORY)
  private readonly assetRepository!: IAssetRepository;

  async execute(id: string, userId: string): Promise<Asset> {
    const asset = await this.assetRepository.findById(id);

    if (!asset) {
      throw new AssetNotFoundException(id);
    }

    if (asset.userId !== userId) {
      throw new AssetAccessDeniedException();
    }

    return asset;
  }
}
