import { Inject, Injectable } from "@nestjs/common";
import {
  FileInfectedException,
  FileNotFoundException,
  UnauthorizedFileAccessException,
} from "../../domain/exceptions/storage.exceptions";
import type { IFileRepository } from "../../domain/repositories/file.repository.interface";
import { FILE_REPOSITORY } from "../../domain/repositories/file.repository.interface";
import {
  type IStorageService,
  STORAGE_SERVICE,
} from "../../domain/services/storage.service.interface";
import { FileStatus } from "../../domain/value-objects/file-status";

@Injectable()
export class DownloadFileUseCase {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
  ) {}

  async execute(
    fileId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    // 1. Fetch file metadata
    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new FileNotFoundException(fileId);
    }

    // 2. Verify ownership
    if (file.userId !== userId) {
      throw new UnauthorizedFileAccessException(fileId, userId);
    }

    // 3. Check if file is infected
    if (file.status === FileStatus.INFECTED) {
      throw new FileInfectedException(fileId);
    }

    // 4. Download file from S3
    const buffer = await this.storageService.download(file.key);

    return {
      buffer,
      contentType: file.contentType,
      fileName: file.originalName,
    };
  }
}
