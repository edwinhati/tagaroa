import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { File } from "../../domain/entities/file.entity";
import {
  FileSizeLimitExceededException,
  InvalidMimeTypeException,
} from "../../domain/exceptions/storage.exceptions";
import {
  FILE_REPOSITORY,
  type IFileRepository,
} from "../../domain/repositories/file.repository.interface";
import type { IStorageService } from "../../domain/services/storage.service.interface";
import { STORAGE_SERVICE } from "../../domain/services/storage.service.interface";
import { FileStatus } from "../../domain/value-objects/file-status";
import { UploadFileUseCase } from "./upload-file.use-case";

const now = new Date("2024-01-01");

const mockPendingFile = new File(
  "file-id",
  "uploads/user-1/file-id",
  "test-bucket",
  null,
  1024,
  "image/jpeg",
  "photo.jpg",
  "user-1",
  FileStatus.PENDING,
  null,
  null,
  now,
  now,
  1,
);

describe("UploadFileUseCase", () => {
  let useCase: UploadFileUseCase;
  let fileRepo: jest.Mocked<IFileRepository>;
  let storageService: jest.Mocked<IStorageService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UploadFileUseCase,
        {
          provide: FILE_REPOSITORY,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
            findById: jest.fn(),
            findByUserId: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: STORAGE_SERVICE,
          useValue: {
            upload: jest.fn().mockResolvedValue("https://bucket/key"),
            download: jest.fn(),
            getPresignedUrl: jest.fn(),
            delete: jest.fn(),
            getBucket: jest.fn().mockReturnValue("test-bucket"),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(10 * 1024 * 1024), // 10MB
          },
        },
      ],
    }).compile();

    useCase = module.get(UploadFileUseCase);
    fileRepo = module.get(FILE_REPOSITORY);
    storageService = module.get(STORAGE_SERVICE);
  });

  it("uploads a valid file and returns the scanned file", async () => {
    const scannedFile = mockPendingFile.markAsScanned();
    fileRepo.create.mockResolvedValue(mockPendingFile);
    fileRepo.update.mockResolvedValue(scannedFile);

    const buffer = Buffer.alloc(1024, "x");
    const result = await useCase.execute(
      "user-1",
      buffer,
      "photo.jpg",
      "image/jpeg",
    );

    expect(storageService.upload).toHaveBeenCalledWith(
      expect.stringContaining("uploads/user-1/"),
      buffer,
      "image/jpeg",
    );
    expect(fileRepo.create).toHaveBeenCalledTimes(1);
    expect(fileRepo.update).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(FileStatus.SCANNED);
  });

  it("rejects files that exceed MAX_FILE_SIZE", async () => {
    const oversized = Buffer.alloc(11 * 1024 * 1024); // 11 MB
    await expect(
      useCase.execute("user-1", oversized, "large.jpg", "image/jpeg"),
    ).rejects.toThrow(FileSizeLimitExceededException);
    expect(storageService.upload).not.toHaveBeenCalled();
  });

  it("rejects disallowed MIME types", async () => {
    const buffer = Buffer.alloc(1024);
    await expect(
      useCase.execute("user-1", buffer, "script.sh", "application/x-sh"),
    ).rejects.toThrow(InvalidMimeTypeException);
    expect(storageService.upload).not.toHaveBeenCalled();
  });
});
