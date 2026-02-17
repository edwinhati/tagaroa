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

export class InvalidAccountTypeException extends DomainException {
  constructor(type: string) {
    super("INVALID_ACCOUNT_TYPE", `Invalid account type: '${type}'`);
    this.name = "InvalidAccountTypeException";
  }
}

export class InvalidCurrencyException extends DomainException {
  constructor(currency: string) {
    super("INVALID_CURRENCY", `Invalid currency: '${currency}'`);
    this.name = "InvalidCurrencyException";
  }
}
