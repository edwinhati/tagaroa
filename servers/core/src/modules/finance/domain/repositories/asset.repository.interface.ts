import type {
  AggregationBucket,
  PaginatedResult,
} from "../../../../shared/types/pagination";
import { Asset } from "../entities/asset.entity";

export const ASSET_REPOSITORY = Symbol("ASSET_REPOSITORY");

export type AssetFilterParams = {
  search?: string;
  types?: string[];
  currencies?: string[];
};

export interface IAssetRepository {
  findById(id: string): Promise<Asset | null>;
  findByIds(ids: string[]): Promise<Asset[]>;
  findByUserId(userId: string): Promise<Asset[]>;
  findByUserIdPaginated(
    userId: string,
    offset: number,
    limit: number,
    filters?: AssetFilterParams,
  ): Promise<PaginatedResult<Asset>>;
  aggregateByType(
    userId: string,
    filters?: AssetFilterParams,
  ): Promise<AggregationBucket[]>;
  aggregateByCurrency(
    userId: string,
    filters?: AssetFilterParams,
  ): Promise<AggregationBucket[]>;
  getTotalValue(userId: string, currency?: string): Promise<number>;
  create(asset: Asset): Promise<Asset>;
  update(asset: Asset): Promise<Asset>;
  delete(id: string): Promise<void>;
}
