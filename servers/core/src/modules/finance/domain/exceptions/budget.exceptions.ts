import { DomainException } from "../../../../shared/exceptions/domain.exception";

export class BudgetNotFoundException extends DomainException {
  constructor(id: string) {
    super("BUDGET_NOT_FOUND", `Budget with id '${id}' not found`);
    this.name = "BudgetNotFoundException";
  }
}

export class BudgetAccessDeniedException extends DomainException {
  constructor() {
    super("BUDGET_ACCESS_DENIED", "You do not have access to this budget");
    this.name = "BudgetAccessDeniedException";
  }
}

export class BudgetAlreadyExistsException extends DomainException {
  constructor(month: number, year: number) {
    super(
      "BUDGET_ALREADY_EXISTS",
      `Budget already exists for ${month}/${year}`,
    );
    this.name = "BudgetAlreadyExistsException";
  }
}

export class BudgetItemNotFoundException extends DomainException {
  constructor(id: string) {
    super("BUDGET_ITEM_NOT_FOUND", `Budget item with id '${id}' not found`);
    this.name = "BudgetItemNotFoundException";
  }
}

export class BudgetAllocationExceededException extends DomainException {
  constructor(totalAllocations: number, budgetAmount: number) {
    super(
      "BUDGET_ALLOCATION_EXCEEDED",
      `Total allocations (${totalAllocations}) exceed budget amount (${budgetAmount})`,
    );
    this.name = "BudgetAllocationExceededException";
  }
}
