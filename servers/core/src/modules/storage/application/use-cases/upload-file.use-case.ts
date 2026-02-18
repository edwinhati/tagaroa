import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../../shared/config/env.validation";
import { File } from "../../domain/entities/file.entity";
import {
  FileSizeLimitExceededException,
  InvalidMimeTypeException,
} from "../../domain/exceptions/storage.exceptions";
import type { IFileRepository } from "../../domain/repositories/file.repository.interface";
import { FILE_REPOSITORY } from "../../domain/repositories/file.repository.interface";
import type { IStorageService } from "../../domain/services/storage.service.interface";
import { STORAGE_SERVICE } from "../../domain/services/storage.service.interface";
import { MimeType } from "../../domain/value-objects/mime-type";

@Injectable()
export class UploadFileUseCase {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async execute(
    userId: string,
    fileBuffer: Buffer,
    originalName: string,
    contentType: string,
  ): Promise<File> {
    const maxFileSize = this.configService.get("MAX_FILE_SIZE", {
      infer: true,
    });

    // 1. Validate file size
    if (fileBuffer.length > maxFileSize) {
      throw new FileSizeLimitExceededException(fileBuffer.length, maxFileSize);
    }

    // 2. Validate MIME type
    if (!MimeType.isAllowed(contentType)) {
      throw new InvalidMimeTypeException(contentType);
    }

    // 3. Generate file metadata
    const fileId = crypto.randomUUID();
    const key = `uploads/${userId}/${fileId}`;
    const bucket = this.storageService.getBucket();

    // 4. Upload to S3
    await this.storageService.upload(key, fileBuffer, contentType);

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
