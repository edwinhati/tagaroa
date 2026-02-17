import { FileStatus } from "../value-objects/file-status";

export class File {
  constructor(
    public readonly id: string,
    public readonly key: string,
    public readonly bucket: string,
    public readonly url: string | null,
    public readonly size: number,
    public readonly contentType: string,
    public readonly originalName: string,
    public readonly userId: string,
    public readonly status: FileStatus,
    public readonly scanResult: string | null,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number,
  ) {}

  static create(
    id: string,
    key: string,
    bucket: string,
    size: number,
    contentType: string,
    originalName: string,
    userId: string,
  ): File {
    return new File(
      id,
      key,
      bucket,
      null, // URL generated later
      size,
      contentType,
      originalName,
      userId,
      FileStatus.PENDING,
      null,
      null,
      new Date(),
      new Date(),
      1,
    );
  }

  markAsScanned(): File {
    return new File(
      this.id,
      this.key,
      this.bucket,
      this.url,
      this.size,
      this.contentType,
      this.originalName,
      this.userId,
      FileStatus.SCANNED,
      "Clean",
      this.deletedAt,
      this.createdAt,
      new Date(),
      this.version,
    );
  }

  markAsInfected(scanResult: string): File {
    return new File(
      this.id,
      this.key,
      this.bucket,
      this.url,
      this.size,
      this.contentType,
      this.originalName,
      this.userId,
      FileStatus.INFECTED,
      scanResult,
      this.deletedAt,
      this.createdAt,
      new Date(),
      this.version,
    );
  }
}
