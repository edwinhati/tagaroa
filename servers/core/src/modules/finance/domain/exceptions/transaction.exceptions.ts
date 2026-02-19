import { DomainException } from "../../../../shared/exceptions/domain.exception";

export class TransactionNotFoundException extends DomainException {
  constructor(id: string) {
    super("TRANSACTION_NOT_FOUND", `Transaction with id '${id}' not found`);
    this.name = "TransactionNotFoundException";
  }
}

export class TransactionAccessDeniedException extends DomainException {
  constructor() {
    super(
      "TRANSACTION_ACCESS_DENIED",
      "You do not have access to this transaction",
    );
    this.name = "TransactionAccessDeniedException";
  }
}
