import { Inject, Injectable } from "@nestjs/common";
import type { File } from "../../domain/entities/file.entity";
import {
  FileNotFoundException,
  UnauthorizedFileAccessException,
} from "../../domain/exceptions/storage.exceptions";
import type { IFileRepository } from "../../domain/repositories/file.repository.interface";
import { FILE_REPOSITORY } from "../../domain/repositories/file.repository.interface";

@Injectable()
export class GetFileUseCase {
  @Inject(FILE_REPOSITORY)
  private readonly fileRepository!: IFileRepository;

  async execute(fileId: string, userId: string): Promise<File> {
    // 1. Fetch file metadata
    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new FileNotFoundException(fileId);
    }

    // 2. Verify ownership
    if (file.userId !== userId) {
      throw new UnauthorizedFileAccessException(fileId, userId);
    }

    return file;
  }
}
