import type {
  AggregationBucket,
  PaginatedResult,
} from "../../../../shared/types/pagination";
import type { Account } from "../entities/account.entity";
import type { AccountCategory } from "../value-objects/account-category";

export const ACCOUNT_REPOSITORY = Symbol("ACCOUNT_REPOSITORY");

export type AccountFilterParams = {
  search?: string;
  types?: string[];
  categories?: AccountCategory[];
};

export type CategoryAggregationResult = {
  category: AccountCategory;
  count: number;
  totalBalance: number;
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
  aggregateByCategory(
    userId: string,
    filters?: Omit<AccountFilterParams, "categories">,
  ): Promise<CategoryAggregationResult[]>;
  findAllActiveUserIds(): Promise<string[]>;
  create(account: Account): Promise<Account>;
  update(account: Account): Promise<Account>;
  delete(id: string): Promise<void>;
}
