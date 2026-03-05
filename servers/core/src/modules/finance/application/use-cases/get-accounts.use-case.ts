import { Inject, Injectable } from "@nestjs/common";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../../../shared/types/pagination";
import type { Account } from "../../domain/entities/account.entity";
import type {
  AccountFilterParams,
  IAccountRepository,
} from "../../domain/repositories/account.repository.interface";
import { ACCOUNT_REPOSITORY } from "../../domain/repositories/account.repository.interface";

@Injectable()
export class GetAccountsUseCase {
  @Inject(ACCOUNT_REPOSITORY)
  private readonly accountRepository!: IAccountRepository;

  async execute(
    userId: string,
    pagination: PaginationParams,
    filters?: AccountFilterParams,
  ): Promise<PaginatedResult<Account>> {
    const offset = (pagination.page - 1) * pagination.limit;
    const [result, typeAggregations] = await Promise.all([
      this.accountRepository.findByUserIdPaginated(
        userId,
        offset,
        pagination.limit,
        filters,
      ),
      this.accountRepository.aggregateByType(userId, filters),
    ]);

    return {
      ...result,
      aggregations: {
        type: typeAggregations,
      },
    };
  }
}
