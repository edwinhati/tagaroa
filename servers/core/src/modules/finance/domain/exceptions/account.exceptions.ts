import { DomainException } from "../../../../shared/exceptions/domain.exception";

export class AccountNotFoundException extends DomainException {
  constructor(id: string) {
    super("ACCOUNT_NOT_FOUND", `Account with id '${id}' not found`);
    this.name = "AccountNotFoundException";
  }
}

export class AccountAccessDeniedException extends DomainException {
  constructor() {
    super("ACCOUNT_ACCESS_DENIED", "You do not have access to this account");
    this.name = "AccountAccessDeniedException";
  }
}
