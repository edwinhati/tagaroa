export class DomainException extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainException";
  }
}

export class ConcurrentModificationException extends DomainException {
  constructor(entity: string, id: string) {
    super(
      "CONCURRENT_MODIFICATION",
      `${entity} with id '${id}' was modified by another request`,
    );
    this.name = "ConcurrentModificationException";
  }
}
