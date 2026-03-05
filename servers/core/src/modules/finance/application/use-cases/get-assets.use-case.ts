import { Inject, Injectable } from "@nestjs/common";
import type { PaginationParams } from "../../../../shared/types/pagination";
import type { Asset } from "../../domain/entities/asset.entity";
import type {
  AssetFilterParams,
  IAssetRepository,
} from "../../domain/repositories/asset.repository.interface";
import { ASSET_REPOSITORY } from "../../domain/repositories/asset.repository.interface";

@Injectable()
export class GetAssetsUseCase {
  constructor(
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository,
  ) {}

  async execute(
    userId: string,
    pagination: PaginationParams,
    filters?: AssetFilterParams,
  ): Promise<{
    items: Asset[];
    total: number;
    aggregations: {
      type: Awaited<ReturnType<IAssetRepository["aggregateByType"]>>;
      currency: Awaited<ReturnType<IAssetRepository["aggregateByCurrency"]>>;
    };
  }> {
    const offset = (pagination.page - 1) * pagination.limit;
    const [result, typeAggregations, currencyAggregations] = await Promise.all([
      this.assetRepository.findByUserIdPaginated(
        userId,
        offset,
        pagination.limit,
        filters,
      ),
      this.assetRepository.aggregateByType(userId, filters),
      this.assetRepository.aggregateByCurrency(userId, filters),
    ]);

    return {
      items: result.items,
      total: result.total,
      aggregations: {
        type: typeAggregations,
        currency: currencyAggregations,
      },
    };
  }
}
