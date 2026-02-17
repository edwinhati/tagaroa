import { Injectable } from "@nestjs/common";
import { TransactionType } from "../../domain/value-objects/transaction-type";

@Injectable()
export class GetTransactionTypesUseCase {
  execute(): string[] {
    return Object.values(TransactionType);
  }
}
