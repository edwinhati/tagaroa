import { Inject, Injectable } from "@nestjs/common";
import {
  FileInfectedException,
  FileNotFoundException,
  UnauthorizedFileAccessException,
} from "../../domain/exceptions/storage.exceptions";
import type { IFileRepository } from "../../domain/repositories/file.repository.interface";
import { FILE_REPOSITORY } from "../../domain/repositories/file.repository.interface";
import { FileStatus } from "../../domain/value-objects/file-status";
import { S3ClientService } from "../../infrastructure/s3/s3-client.service";

@Injectable()
export class GetPresignedUrlUseCase {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly s3Client: S3ClientService,
  ) {}

  async execute(
    fileId: string,
    userId: string,
    expiresIn = 3600,
  ): Promise<{ url: string; expiry: string }> {
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

    // 4. Generate presigned URL
    const url = await this.s3Client.getPresignedUrl(file.key, expiresIn);

    // 5. Calculate expiry time
    const expiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    return { url, expiry };
  }
}
