import { Module } from "@nestjs/common";
import { DeleteFileUseCase } from "./application/use-cases/delete-file.use-case";
import { DownloadFileUseCase } from "./application/use-cases/download-file.use-case";
import { GetFileUseCase } from "./application/use-cases/get-file.use-case";
import { GetPresignedUrlUseCase } from "./application/use-cases/get-presigned-url.use-case";
import { UploadFileUseCase } from "./application/use-cases/upload-file.use-case";
import { FILE_REPOSITORY } from "./domain/repositories/file.repository.interface";
import { STORAGE_SERVICE } from "./domain/services/storage.service.interface";
import { DrizzleFileRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-file.repository";
import { S3ClientService } from "./infrastructure/s3/s3-client.service";
import { StorageController } from "./presentation/http/storage.controller";

@Module({
  controllers: [StorageController],
  providers: [
    // S3 Client (infrastructure layer)
    S3ClientService,

    // Bind S3ClientService to the domain interface token
    {
      provide: STORAGE_SERVICE,
      useExisting: S3ClientService,
    },

    // Repositories
    {
      provide: FILE_REPOSITORY,
      useClass: DrizzleFileRepository,
    },

    // Use Cases
    UploadFileUseCase,
    GetFileUseCase,
    DownloadFileUseCase,
    GetPresignedUrlUseCase,
    DeleteFileUseCase,
  ],
  exports: [S3ClientService, STORAGE_SERVICE],
})
export class StorageModule {}
