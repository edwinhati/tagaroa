import type {
  AggregationBucket,
  PaginatedResult,
} from "../../../../shared/types/pagination";
import type { Liability } from "../entities/liability.entity";

export const LIABILITY_REPOSITORY = Symbol("LIABILITY_REPOSITORY");

export type LiabilityFilterParams = {
  search?: string;
  types?: string[];
  currencies?: string[];
  includePaid?: boolean;
};

export interface ILiabilityRepository {
  findById(id: string): Promise<Liability | null>;
  findByIds(ids: string[]): Promise<Liability[]>;
  findByUserId(userId: string): Promise<Liability[]>;
  findByUserIdPaginated(
    userId: string,
    offset: number,
    limit: number,
    filters?: LiabilityFilterParams,
  ): Promise<PaginatedResult<Liability>>;
  aggregateByType(
    userId: string,
    filters?: LiabilityFilterParams,
  ): Promise<AggregationBucket[]>;
  aggregateByCurrency(
    userId: string,
    filters?: LiabilityFilterParams,
  ): Promise<AggregationBucket[]>;
  getTotalAmount(userId: string, currency?: string): Promise<number>;
  create(liability: Liability): Promise<Liability>;
  update(liability: Liability): Promise<Liability>;
  delete(id: string): Promise<void>;
}
