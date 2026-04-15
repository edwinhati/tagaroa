import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TransactionDeletedEvent } from "../../domain/events/transaction-deleted.event";
import {
  TransactionAccessDeniedException,
  TransactionNotFoundException,
} from "../../domain/exceptions/transaction.exceptions";
import {
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from "../../domain/repositories/transaction.repository.interface";

@Injectable()
export class DeleteTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    const existing = await this.transactionRepository.findById(id);

    if (!existing) {
      throw new TransactionNotFoundException(id);
    }
    if (existing.userId !== userId) {
      throw new TransactionAccessDeniedException();
    }

    await this.transactionRepository.delete(id);

    this.eventEmitter.emit(
      "transaction.deleted",
      new TransactionDeletedEvent(
        existing.id,
        userId,
        existing.accountId,
        existing.budgetItemId,
        existing.amount,
        existing.type,
      ),
    );
  }
}
