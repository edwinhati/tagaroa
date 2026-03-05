import { Inject, Injectable } from "@nestjs/common";
import { Asset } from "../../domain/entities/asset.entity";
import type { IAssetRepository } from "../../domain/repositories/asset.repository.interface";
import { ASSET_REPOSITORY } from "../../domain/repositories/asset.repository.interface";
import type { CreateAssetDto } from "../dtos/create-asset.dto";

@Injectable()
export class CreateAssetUseCase {
  @Inject(ASSET_REPOSITORY)
  private readonly assetRepository!: IAssetRepository;

  async execute(dto: CreateAssetDto, userId: string): Promise<Asset> {
    const now = new Date();
    const asset = new Asset(
      crypto.randomUUID(),
      userId,
      dto.name,
      dto.type,
      dto.value ?? 0,
      dto.shares ?? null,
      dto.ticker ?? null,
      dto.currency,
      dto.notes ?? null,
      null,
      now,
      now,
      1,
    );

    return this.assetRepository.create(asset);
  }
}
