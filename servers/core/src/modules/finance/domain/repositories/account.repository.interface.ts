import type {
  AggregationBucket,
  PaginatedResult,
} from "../../../../shared/types/pagination";
import { Account } from "../entities/account.entity";

export const ACCOUNT_REPOSITORY = Symbol("ACCOUNT_REPOSITORY");

export type AccountFilterParams = {
  search?: string;
  types?: string[];
};

export interface IAccountRepository {
  findById(id: string): Promise<Account | null>;
  findByIds(ids: string[]): Promise<Account[]>;
  findByUserId(userId: string): Promise<Account[]>;
  findByUserIdPaginated(
    userId: string,
    offset: number,
    limit: number,
    filters?: AccountFilterParams,
  ): Promise<PaginatedResult<Account>>;
  aggregateByType(
    userId: string,
    filters?: AccountFilterParams,
  ): Promise<AggregationBucket[]>;
  create(account: Account): Promise<Account>;
  update(account: Account): Promise<Account>;
  delete(id: string): Promise<void>;
}
