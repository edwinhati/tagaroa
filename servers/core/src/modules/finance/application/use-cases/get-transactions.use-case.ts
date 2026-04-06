import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PaginatedResult } from "../../../../shared/types/pagination";
import type { Account } from "../../domain/entities/account.entity";
import type { BudgetItem } from "../../domain/entities/budget-item.entity";
import type { Transaction } from "../../domain/entities/transaction.entity";
import {
  ACCOUNT_REPOSITORY,
  type IAccountRepository,
} from "../../domain/repositories/account.repository.interface";
import {
  BUDGET_ITEM_REPOSITORY,
  type IBudgetItemRepository,
} from "../../domain/repositories/budget-item.repository.interface";
import {
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from "../../domain/repositories/transaction.repository.interface";
import type { GetTransactionsDto } from "../dtos/get-transactions.dto";

type TransactionWithRelations = {
  transaction: Transaction;
  account: Account;
  budgetItem: BudgetItem | null;
};

@Injectable()
export class GetTransactionsUseCase {
  private readonly logger = new Logger(GetTransactionsUseCase.name);

  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(BUDGET_ITEM_REPOSITORY)
    private readonly budgetItemRepository: IBudgetItemRepository,
  ) {}

  async execute(
    userId: string,
    dto: GetTransactionsDto,
  ): Promise<PaginatedResult<TransactionWithRelations>> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

    const filterParams = {
      search: dto.search,
      types: dto.type,
      accountIds: dto.accountId,
      budgetItems: dto.budgetItemId,
      currencies: dto.currency,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      orderBy: dto.orderBy,
    };

    // Step 1: Fetch transactions and aggregations in parallel
    // Remove specific filters when aggregating by that dimension
    const { currencies: _, ...filtersWithoutCurrency } = filterParams;

    const [
      result,
      typeAggregations,
      currencyAggregations,
      accountAggregations,
      categoryAggregations,
    ] = await Promise.all([
      this.transactionRepository.findAll(userId, offset, limit, filterParams),
      this.transactionRepository.aggregateByType(userId, filterParams),
      this.transactionRepository.aggregateByCurrency(
        userId,
        filtersWithoutCurrency,
      ),
      this.transactionRepository.aggregateByAccount(userId, filterParams),
      this.transactionRepository.aggregateByCategory(userId, filterParams),
    ]);

    // Step 2: Extract unique IDs
    const accountIds = [...new Set(result.items.map((t) => t.accountId))];
    const budgetItemIds = [
      ...new Set(
        result.items
          .map((t) => t.budgetItemId)
          .filter((id): id is string => id !== null),
      ),
    ];

    // Step 3: Batch fetch related entities
    const [accounts, budgetItems] = await Promise.all([
      this.accountRepository.findByIds(accountIds),
      this.budgetItemRepository.findByIds(budgetItemIds),
    ]);

    // Step 4: Create lookup maps
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const budgetItemMap = new Map(budgetItems.map((bi) => [bi.id, bi]));

    // Step 5: Combine data and filter out orphaned transactions
    const transactionsWithRelations = result.items
      .map((transaction) => {
        const account = accountMap.get(transaction.accountId);
        if (!account) {
          this.logger.warn(
            `Orphaned transaction detected: Transaction ${transaction.id} references non-existent account ${transaction.accountId}. This transaction will be excluded from results.`,
          );
          return null;
        }
        return {
          transaction,
          account,
          budgetItem: transaction.budgetItemId
            ? (budgetItemMap.get(transaction.budgetItemId) ?? null)
            : null,
        };
      })
      .filter((item): item is TransactionWithRelations => item !== null);

    return {
      items: transactionsWithRelations,
      total: result.total,
      aggregations: {
        type: typeAggregations,
        currency: currencyAggregations,
        account: accountAggregations,
        category: categoryAggregations,
      },
    };
  }
}
