import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { File } from "../model/file";
import { FileService } from "./file-service";

// Suppress console.error during tests
spyOn(console, "error").mockImplementation(() => {});

// Create mock repository
const createMockRepository = () => ({
  create: mock(() => Promise.resolve({} as File)),
  findUnique: mock(() => Promise.resolve(null as File | null)),
  findMany: mock(() => Promise.resolve([] as File[])),
  count: mock(() => Promise.resolve(0)),
  update: mock(() => Promise.resolve(null as File | null)),
  softDelete: mock(() => Promise.resolve(false)),
  getContentTypeAggregations: mock(() =>
    Promise.resolve(
      {} as Record<string, { count: number; total_size: number }>,
    ),
  ),
});

// Create mock S3 service
const createMockS3Service = () => ({
  upload: mock(() =>
    Promise.resolve({ url: "https://s3.com/file", key: "key" }),
  ),
  download: mock(() => Promise.resolve(new Blob())),
  delete: mock(() => Promise.resolve()),
  presignDownload: mock(() => "https://presigned-download.com"),
  presignUpload: mock(() => "https://presigned-upload.com"),
});

describe("FileService", () => {
  let fileService: FileService;
  let mockRepository: ReturnType<typeof createMockRepository>;
  let mockS3Service: ReturnType<typeof createMockS3Service>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockS3Service = createMockS3Service();
    // biome-ignore lint/suspicious/noExplicitAny: mock types for testing
    fileService = new FileService(mockRepository as any, mockS3Service as any);
  });

  describe("uploadFile", () => {
    test("uploads file and saves metadata", async () => {
      const file = new Blob(["test content"], { type: "text/plain" });
      const expectedFile: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "uploads/test.txt",
        size: file.size,
        content_type: "text/plain",
        original_name: "test.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockS3Service.upload.mockResolvedValue({
        url: "https://s3.com/file",
        key: "uploads/test.txt",
      });
      mockRepository.create.mockResolvedValue(expectedFile);

      const result = await fileService.uploadFile({
        file,
        originalName: "test.txt",
        contentType: "text/plain",
        prefix: "uploads",
      });

      expect(result.file).toEqual(expectedFile);
      expect(result.url).toBe("https://s3.com/file");
      expect(mockS3Service.upload).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
    });

    test("uses file type when contentType not provided", async () => {
      const file = new Blob(["test"], { type: "image/jpeg" });
      const expectedFile: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "photo.jpg",
        size: file.size,
        content_type: "image/jpeg",
        original_name: "photo.jpg",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockS3Service.upload.mockResolvedValue({
        url: "https://s3.com/file",
        key: "photo.jpg",
      });
      mockRepository.create.mockResolvedValue(expectedFile);

      const result = await fileService.uploadFile({
        file,
        originalName: "photo.jpg",
      });

      expect(result.file.content_type).toBe("image/jpeg");
    });

    test("uses default content type when none available", async () => {
      const file = new Blob(["test"]);
      Object.defineProperty(file, "type", { value: "" });

      const expectedFile: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "file.bin",
        size: file.size,
        content_type: "application/octet-stream",
        original_name: "file.bin",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockS3Service.upload.mockResolvedValue({
        url: "https://s3.com/file",
        key: "file.bin",
      });
      mockRepository.create.mockResolvedValue(expectedFile);

      const result = await fileService.uploadFile({
        file,
        originalName: "file.bin",
      });

      expect(result.file.content_type).toBe("application/octet-stream");
    });
  });

  describe("getFile", () => {
    test("returns file when found", async () => {
      const expectedFile: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "uploads/test.txt",
        size: 100,
        content_type: "text/plain",
        original_name: "test.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.findUnique.mockResolvedValue(expectedFile);

      const result = await fileService.getFile("123");

      expect(result).toEqual(expectedFile);
      expect(mockRepository.findUnique).toHaveBeenCalledWith({
        where: { id: "123" },
      });
    });

    test("returns null when file not found", async () => {
      mockRepository.findUnique.mockResolvedValue(null);

      const result = await fileService.getFile("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getFileByKey", () => {
    test("returns file when found by key", async () => {
      const expectedFile: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "uploads/test.txt",
        size: 100,
        content_type: "text/plain",
        original_name: "test.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.findUnique.mockResolvedValue(expectedFile);

      const result = await fileService.getFileByKey("uploads/test.txt");

      expect(result).toEqual(expectedFile);
      expect(mockRepository.findUnique).toHaveBeenCalledWith({
        where: { key: "uploads/test.txt" },
      });
    });

    test("returns null when file not found by key", async () => {
      mockRepository.findUnique.mockResolvedValue(null);

      const result = await fileService.getFileByKey("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("listFiles", () => {
    test("lists files with default params", async () => {
      const files: File[] = [
        {
          id: "1",
          url: "https://s3.com/file1",
          key: "file1.txt",
          size: 100,
          content_type: "text/plain",
          original_name: "file1.txt",
          deleted_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockRepository.findMany.mockResolvedValue(files);
      mockRepository.count.mockResolvedValue(1);

      const result = await fileService.listFiles({});

      expect(result.files).toEqual(files);
      expect(result.total).toBe(1);
    });

    test("lists files with search filter", async () => {
      mockRepository.findMany.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await fileService.listFiles({ search: "test" });

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ search: "test" }),
        }),
      );
    });

    test("lists files with content type filter", async () => {
      mockRepository.findMany.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await fileService.listFiles({ contentType: "image/jpeg" });

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ content_type: "image/jpeg" }),
        }),
      );
    });

    test("lists files with pagination", async () => {
      mockRepository.findMany.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await fileService.listFiles({ limit: 20, offset: 10 });

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 10,
        }),
      );
    });

    test("lists files with custom orderBy", async () => {
      mockRepository.findMany.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await fileService.listFiles({ orderBy: "size DESC" });

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: "size DESC",
        }),
      );
    });
  });

  describe("downloadFile", () => {
    test("downloads file when found", async () => {
      const file: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "uploads/test.txt",
        size: 100,
        content_type: "text/plain",
        original_name: "test.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const blob = new Blob(["test content"]);

      mockRepository.findUnique.mockResolvedValue(file);
      mockS3Service.download.mockResolvedValue(blob);

      const result = await fileService.downloadFile("123");

      expect(result).not.toBeNull();
      expect(result?.file).toEqual(file);
      expect(result?.blob).toBe(blob);
      expect(mockS3Service.download).toHaveBeenCalledWith("uploads/test.txt");
    });

    test("returns null when file not found", async () => {
      mockRepository.findUnique.mockResolvedValue(null);

      const result = await fileService.downloadFile("nonexistent");

      expect(result).toBeNull();
      expect(mockS3Service.download).not.toHaveBeenCalled();
    });
  });

  describe("getDownloadUrl", () => {
    test("generates download URL when file found", async () => {
      const file: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "uploads/test.txt",
        size: 100,
        content_type: "text/plain",
        original_name: "test.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.findUnique.mockResolvedValue(file);
      mockS3Service.presignDownload.mockReturnValue(
        "https://presigned-download.com",
      );

      const result = await fileService.getDownloadUrl("123", 7200);

      expect(result).not.toBeNull();
      expect(result?.url).toBe("https://presigned-download.com");
      expect(result?.file).toEqual(file);
      expect(mockS3Service.presignDownload).toHaveBeenCalledWith(
        "uploads/test.txt",
        { expiresIn: 7200 },
      );
    });

    test("returns null when file not found", async () => {
      mockRepository.findUnique.mockResolvedValue(null);

      const result = await fileService.getDownloadUrl("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getUploadUrl", () => {
    test("generates upload URL", async () => {
      mockS3Service.presignUpload.mockReturnValue(
        "https://presigned-upload.com",
      );

      const result = await fileService.getUploadUrl({
        originalName: "test.txt",
        contentType: "text/plain",
        expiresIn: 3600,
        prefix: "uploads",
      });

      expect(result.url).toBe("https://presigned-upload.com");
      expect(result.key).toBeDefined();
    });

    test("generates upload URL without optional params", async () => {
      mockS3Service.presignUpload.mockReturnValue(
        "https://presigned-upload.com",
      );

      const result = await fileService.getUploadUrl({
        originalName: "test.txt",
      });

      expect(result.url).toBe("https://presigned-upload.com");
      expect(result.key).toBeDefined();
    });
  });

  describe("deleteFile", () => {
    test("deletes file when found", async () => {
      const file: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "uploads/test.txt",
        size: 100,
        content_type: "text/plain",
        original_name: "test.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.findUnique.mockResolvedValue(file);
      mockRepository.softDelete.mockResolvedValue(true);

      const result = await fileService.deleteFile("123");

      expect(result).toBe(true);
      expect(mockRepository.softDelete).toHaveBeenCalledWith("123");
      expect(mockS3Service.delete).toHaveBeenCalledWith("uploads/test.txt");
    });

    test("returns false when file not found", async () => {
      mockRepository.findUnique.mockResolvedValue(null);

      const result = await fileService.deleteFile("nonexistent");

      expect(result).toBe(false);
      expect(mockRepository.softDelete).not.toHaveBeenCalled();
    });

    test("continues even if S3 deletion fails", async () => {
      const file: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "uploads/test.txt",
        size: 100,
        content_type: "text/plain",
        original_name: "test.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.findUnique.mockResolvedValue(file);
      mockRepository.softDelete.mockResolvedValue(true);
      mockS3Service.delete.mockRejectedValue(new Error("S3 error"));

      const result = await fileService.deleteFile("123");

      expect(result).toBe(true);
    });

    test("does not delete from S3 if soft delete fails", async () => {
      const file: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "uploads/test.txt",
        size: 100,
        content_type: "text/plain",
        original_name: "test.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.findUnique.mockResolvedValue(file);
      mockRepository.softDelete.mockResolvedValue(false);

      const result = await fileService.deleteFile("123");

      expect(result).toBe(false);
      expect(mockS3Service.delete).not.toHaveBeenCalled();
    });
  });

  describe("fileExists", () => {
    test("returns true when file exists", async () => {
      const file: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "uploads/test.txt",
        size: 100,
        content_type: "text/plain",
        original_name: "test.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.findUnique.mockResolvedValue(file);

      const result = await fileService.fileExists("123");

      expect(result).toBe(true);
    });

    test("returns false when file does not exist", async () => {
      mockRepository.findUnique.mockResolvedValue(null);

      const result = await fileService.fileExists("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("getStats", () => {
    test("returns file statistics", async () => {
      const aggregations = {
        "image/jpeg": { count: 10, total_size: 10240 },
        "image/png": { count: 5, total_size: 5120 },
      };

      mockRepository.count.mockResolvedValue(15);
      mockRepository.getContentTypeAggregations.mockResolvedValue(aggregations);

      const result = await fileService.getStats();

      expect(result.totalFiles).toBe(15);
      expect(result.totalSize).toBe(15360);
      expect(result.byContentType).toEqual(aggregations);
    });

    test("returns zero stats when no files", async () => {
      mockRepository.count.mockResolvedValue(0);
      mockRepository.getContentTypeAggregations.mockResolvedValue({});

      const result = await fileService.getStats();

      expect(result.totalFiles).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.byContentType).toEqual({});
    });
  });
});
