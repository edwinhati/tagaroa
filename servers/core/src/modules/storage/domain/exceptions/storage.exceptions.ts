import { DomainException } from "../../../../shared/exceptions/domain.exception";

export class FileNotFoundException extends DomainException {
  constructor(fileId: string) {
    super("FILE_NOT_FOUND", `File with ID ${fileId} not found`);
    this.name = "FileNotFoundException";
  }
}

export class FileSizeLimitExceededException extends DomainException {
  constructor(size: number, limit: number) {
    super(
      "FILE_SIZE_LIMIT_EXCEEDED",
      `File size ${size} bytes exceeds limit of ${limit} bytes`,
    );
    this.name = "FileSizeLimitExceededException";
  }
}

export class InvalidMimeTypeException extends DomainException {
  constructor(mimeType: string) {
    super("INVALID_MIME_TYPE", `MIME type ${mimeType} is not allowed`);
    this.name = "InvalidMimeTypeException";
  }
}

export class FileInfectedException extends DomainException {
  constructor(fileId: string) {
    super("FILE_INFECTED", `File ${fileId} is infected and cannot be accessed`);
    this.name = "FileInfectedException";
  }
}

export class UnauthorizedFileAccessException extends DomainException {
  constructor(fileId: string, userId: string) {
    super(
      "UNAUTHORIZED_FILE_ACCESS",
      `User ${userId} is not authorized to access file ${fileId}`,
    );
    this.name = "UnauthorizedFileAccessException";
  }
}
