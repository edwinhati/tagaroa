import { Inject, Injectable } from "@nestjs/common";
import {
  TransactionAccessDeniedException,
  TransactionNotFoundException,
} from "../../domain/exceptions/transaction.exceptions";
import {
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from "../../domain/repositories/transaction.repository.interface";
import { TransactionSideEffectsService } from "../services/transaction-side-effects.service";

@Injectable()
export class DeleteTransactionUseCase {
  @Inject(TRANSACTION_REPOSITORY)
  private readonly transactionRepository!: ITransactionRepository;

  constructor(
    private readonly sideEffectsService: TransactionSideEffectsService,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    const existing = await this.transactionRepository.findById(id);

    if (!existing) {
      throw new TransactionNotFoundException(id);
    }
    if (existing.userId !== userId) {
      throw new TransactionAccessDeniedException();
    }

    const budgetItemId = existing.budgetItemId;
    const accountId = existing.accountId;
    const amount = existing.amount;
    const type = existing.type;

    await this.transactionRepository.delete(id);

    // Update budget item spent field
    if (budgetItemId) {
      await this.sideEffectsService.recalculateSpent(budgetItemId);
    }

    // Update account balance (remove transaction)
    await this.sideEffectsService.updateAccountBalance(
      accountId,
      amount,
      type,
      false, // isAdd = false
    );
  }
}
