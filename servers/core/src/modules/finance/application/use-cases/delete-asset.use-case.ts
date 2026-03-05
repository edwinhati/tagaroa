import { Inject, Injectable } from "@nestjs/common";
import {
  AssetAccessDeniedException,
  AssetNotFoundException,
} from "../../domain/exceptions/asset.exceptions";
import type { IAssetRepository } from "../../domain/repositories/asset.repository.interface";
import { ASSET_REPOSITORY } from "../../domain/repositories/asset.repository.interface";

@Injectable()
export class DeleteAssetUseCase {
  @Inject(ASSET_REPOSITORY)
  private readonly assetRepository!: IAssetRepository;

  async execute(id: string, userId: string): Promise<void> {
    const asset = await this.assetRepository.findById(id);

    if (!asset) {
      throw new AssetNotFoundException(id);
    }

    if (asset.userId !== userId) {
      throw new AssetAccessDeniedException();
    }

    await this.assetRepository.delete(id);
  }
}
