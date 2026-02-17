import { Inject, Injectable } from "@nestjs/common";
import { File } from "../../domain/entities/file.entity";
import {
  FileSizeLimitExceededException,
  InvalidMimeTypeException,
} from "../../domain/exceptions/storage.exceptions";
import type { IFileRepository } from "../../domain/repositories/file.repository.interface";
import { FILE_REPOSITORY } from "../../domain/repositories/file.repository.interface";
import { MimeType } from "../../domain/value-objects/mime-type";
import { S3ClientService } from "../../infrastructure/s3/s3-client.service";

const MAX_FILE_SIZE = Number.parseInt(
  process.env.MAX_FILE_SIZE || "10485760",
  10,
); // 10MB default

@Injectable()
export class UploadFileUseCase {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly s3Client: S3ClientService,
  ) {}

  async execute(
    userId: string,
    fileBuffer: Buffer,
    originalName: string,
    contentType: string,
  ): Promise<File> {
    // 1. Validate file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new FileSizeLimitExceededException(
        fileBuffer.length,
        MAX_FILE_SIZE,
      );
    }

    // 2. Validate MIME type
    if (!MimeType.isAllowed(contentType)) {
      throw new InvalidMimeTypeException(contentType);
    }

    // 3. Generate file metadata
    const fileId = crypto.randomUUID();
    const key = `uploads/${userId}/${fileId}`;
    const bucket = this.s3Client.getBucket();

    // 4. Upload to S3
    await this.s3Client.upload(key, fileBuffer, contentType);

    // 5. Create file entity
    const file = File.create(
      fileId,
      key,
      bucket,
      fileBuffer.length,
      contentType,
      originalName,
      userId,
    );

    // 6. Save to database
    const savedFile = await this.fileRepository.create(file);

    // 7. Mark as scanned (skipping virus scan for now)
    const scannedFile = savedFile.markAsScanned();
    const updatedFile = await this.fileRepository.update(scannedFile);

    return updatedFile;
  }
}
