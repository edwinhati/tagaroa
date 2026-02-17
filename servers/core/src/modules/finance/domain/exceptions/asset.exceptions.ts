import { DomainException } from "../../../../shared/exceptions/domain.exception";

export class AssetNotFoundException extends DomainException {
  constructor(id: string) {
    super("ASSET_NOT_FOUND", `Asset with id '${id}' not found`);
    this.name = "AssetNotFoundException";
  }
}

export class AssetAccessDeniedException extends DomainException {
  constructor() {
    super("ASSET_ACCESS_DENIED", "You do not have access to this asset");
    this.name = "AssetAccessDeniedException";
  }
}
