import { DomainException } from "../../../../shared/exceptions/domain.exception";

export class LiabilityNotFoundException extends DomainException {
  constructor(id: string) {
    super("LIABILITY_NOT_FOUND", `Liability with id '${id}' not found`);
    this.name = "LiabilityNotFoundException";
  }
}

export class LiabilityAccessDeniedException extends DomainException {
  constructor() {
    super(
      "LIABILITY_ACCESS_DENIED",
      "You do not have access to this liability",
    );
    this.name = "LiabilityAccessDeniedException";
  }
}
