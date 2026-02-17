import { Inject, Injectable } from "@nestjs/common";
import {
  FileNotFoundException,
  UnauthorizedFileAccessException,
} from "../../domain/exceptions/storage.exceptions";
import type { IFileRepository } from "../../domain/repositories/file.repository.interface";
import { FILE_REPOSITORY } from "../../domain/repositories/file.repository.interface";
import { S3ClientService } from "../../infrastructure/s3/s3-client.service";

@Injectable()
export class DeleteFileUseCase {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly s3Client: S3ClientService,
  ) {}

  async execute(fileId: string, userId: string): Promise<void> {
    // 1. Fetch file metadata
    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new FileNotFoundException(fileId);
    }

    // 2. Verify ownership
    if (file.userId !== userId) {
      throw new UnauthorizedFileAccessException(fileId, userId);
    }

    // 3. Delete from S3
    await this.s3Client.delete(file.key);

    // 4. Soft delete from database
    await this.fileRepository.delete(fileId);
  }
}
