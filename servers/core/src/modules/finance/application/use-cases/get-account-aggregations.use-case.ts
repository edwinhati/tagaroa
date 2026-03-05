import { Inject, Injectable } from "@nestjs/common";
import {
  ACCOUNT_REPOSITORY,
  type IAccountRepository,
} from "../../domain/repositories/account.repository.interface";
import type {
  AccountAggregationDto,
  AccountAggregationsResponseDto,
} from "../dtos/dashboard/account-aggregations-response.dto";

@Injectable()
export class GetAccountAggregationsUseCase {
  @Inject(ACCOUNT_REPOSITORY)
  private readonly accountRepository!: IAccountRepository;

  async execute(userId: string): Promise<AccountAggregationsResponseDto> {
    // Fetch aggregations by type and currency
    const [byType, accounts] = await Promise.all([
      this.accountRepository.aggregateByType(userId),
      this.accountRepository.findByUserId(userId),
    ]);

    // Group accounts by currency
    const currencyMap = new Map<string, number>();
    const currencyCountMap = new Map<string, number>();

    for (const account of accounts) {
      const currency = account.currency;
      currencyMap.set(
        currency,
        (currencyMap.get(currency) || 0) + account.balance,
      );
      currencyCountMap.set(currency, (currencyCountMap.get(currency) || 0) + 1);
    }

    const byCurrencyAgg: AccountAggregationDto[] = Array.from(
      currencyMap.entries(),
    ).map(([currency, balance]) => ({
      type: currency,
      count: currencyCountMap.get(currency) || 0,
      balance,
    }));

    return {
      by_type: byType.map((agg) => ({
        type: agg.key,
        count: agg.count,
        balance: agg.sum,
      })),
      by_currency: byCurrencyAgg,
    };
  }
}
