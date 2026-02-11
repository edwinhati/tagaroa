import { describe, expect, mock, test } from "bun:test";
import { createLoggerPort } from "../ports/logger.port.js";
import {
  type S3ClientInterface,
  type S3Config,
  type S3File,
  S3Service,
} from "./s3-service";

const createMockS3File = (): S3File =>
  ({
    write: mock(() => Promise.resolve(0)),
    stat: mock(() =>
      Promise.resolve({
        size: 1024,
        type: "text/plain",
        lastModified: new Date("2024-01-01"),
        etag: '"abc123"',
      }),
    ),
    exists: mock(() => Promise.resolve(true)),
    delete: mock(() => Promise.resolve()),
    presign: mock(() => "https://presigned-url.com"),
  }) as unknown as S3File;

const createMockS3Client = (mockFile: S3File): S3ClientInterface => ({
  file: mock(() => mockFile),
});

const defaultConfig: S3Config = {
  accessKeyId: "test-key",
  secretAccessKey: "test-secret",
  bucket: "test-bucket",
  endpoint: "http://localhost:9000",
  region: "us-east-1",
};

const mockLogger = createLoggerPort();

describe("S3Service", () => {
  describe("constructor", () => {
    test("creates S3Service with full config", () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        endpoint: "http://localhost:9000",
        region: "us-east-1",
      };
      const service = new S3Service(config, mockLogger);
      expect(service).toBeInstanceOf(S3Service);
    });

    test("creates S3Service with minimal config", () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
      };
      const service = new S3Service(config, mockLogger);
      expect(service).toBeInstanceOf(S3Service);
    });

    test("creates S3Service without endpoint", () => {
      const config: S3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bucket: "test-bucket",
        region: "eu-west-1",
      };
      const service = new S3Service(config, mockLogger);
      expect(service).toBeInstanceOf(S3Service);
    });

    test("creates S3Service with injected client", () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);
      expect(service).toBeInstanceOf(S3Service);
    });
  });

  describe("upload", () => {
    test("uploads string data", async () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const result = await service.upload("test-key", "test content", {
        contentType: "text/plain",
      });

      expect(result.key).toBe("test-key");
      expect(result.url).toBe("https://presigned-url.com");
      expect(mockFile.write).toHaveBeenCalledWith("test content", {
        type: "text/plain",
      });
    });

    test("uploads Blob data", async () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const blob = new Blob(["test content"], { type: "text/plain" });
      const result = await service.upload("test-key", blob);

      expect(result.key).toBe("test-key");
      expect(mockFile.write).toHaveBeenCalled();
    });

    test("uploads ArrayBuffer data", async () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const buffer = new ArrayBuffer(8);
      const result = await service.upload("test-key", buffer);

      expect(result.key).toBe("test-key");
      expect(mockFile.write).toHaveBeenCalled();
    });

    test("uploads Uint8Array data", async () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const uint8 = new Uint8Array([1, 2, 3, 4]);
      const result = await service.upload("test-key", uint8);

      expect(result.key).toBe("test-key");
      expect(mockFile.write).toHaveBeenCalled();
    });

    test("uploads ReadableStream data", async () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("test"));
          controller.close();
        },
      });
      const result = await service.upload("test-key", stream);

      expect(result.key).toBe("test-key");
      expect(mockFile.write).toHaveBeenCalled();
    });

    test("uses default content type when not provided", async () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      await service.upload("test-key", "test content");

      expect(mockFile.write).toHaveBeenCalledWith("test content", {
        type: "application/octet-stream",
      });
    });
  });

  describe("download", () => {
    test("downloads file", async () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const result = await service.download("test-key");

      expect(result).toBe(mockFile);
      expect(mockClient.file).toHaveBeenCalledWith("test-key");
    });
  });

  describe("stat", () => {
    test("returns file metadata", async () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const result = await service.stat("test-key");

      expect(result.size).toBe(1024);
      expect(result.contentType).toBe("text/plain");
      expect(result.etag).toBe('"abc123"');
      expect(mockFile.stat).toHaveBeenCalled();
    });

    test("uses default content type when type is undefined", async () => {
      const mockFile = createMockS3File();
      (mockFile.stat as ReturnType<typeof mock>).mockResolvedValue({
        size: 1024,
        type: undefined,
        lastModified: new Date(),
        etag: '"abc123"',
      });
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const result = await service.stat("test-key");

      expect(result.contentType).toBe("application/octet-stream");
    });
  });

  describe("exists", () => {
    test("returns true when file exists", async () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const result = await service.exists("test-key");

      expect(result).toBe(true);
      expect(mockFile.exists).toHaveBeenCalled();
    });

    test("returns false when file does not exist", async () => {
      const mockFile = createMockS3File();
      (mockFile.exists as ReturnType<typeof mock>).mockResolvedValue(false);
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const result = await service.exists("test-key");

      expect(result).toBe(false);
    });
  });

  describe("delete", () => {
    test("deletes file", async () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      await service.delete("test-key");

      expect(mockFile.delete).toHaveBeenCalled();
      expect(mockClient.file).toHaveBeenCalledWith("test-key");
    });
  });

  describe("presignDownload", () => {
    test("generates presigned download URL with default expiry", () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const result = service.presignDownload("test-key");

      expect(result).toBe("https://presigned-url.com");
      expect(mockFile.presign).toHaveBeenCalledWith({
        method: "GET",
        expiresIn: 3600,
      });
    });

    test("generates presigned download URL with custom expiry", () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const result = service.presignDownload("test-key", { expiresIn: 7200 });

      expect(result).toBe("https://presigned-url.com");
      expect(mockFile.presign).toHaveBeenCalledWith({
        method: "GET",
        expiresIn: 7200,
      });
    });
  });

  describe("presignUpload", () => {
    test("generates presigned upload URL with default options", () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const result = service.presignUpload("test-key");

      expect(result).toBe("https://presigned-url.com");
      expect(mockFile.presign).toHaveBeenCalledWith({
        method: "PUT",
        expiresIn: 3600,
        type: undefined,
        acl: undefined,
      });
    });

    test("generates presigned upload URL with all options", () => {
      const mockFile = createMockS3File();
      const mockClient = createMockS3Client(mockFile);
      const service = new S3Service(defaultConfig, mockLogger, mockClient);

      const result = service.presignUpload("test-key", {
        expiresIn: 7200,
        contentType: "image/jpeg",
        acl: "public-read",
      });

      expect(result).toBe("https://presigned-url.com");
      expect(mockFile.presign).toHaveBeenCalledWith({
        method: "PUT",
        expiresIn: 7200,
        type: "image/jpeg",
        acl: "public-read",
      });
    });
  });

  describe("generateKey", () => {
    test("generates key without prefix", () => {
      const key = S3Service.generateKey("photo.jpg");
      expect(key).toMatch(/^\d+-[a-f0-9]+-photo\.jpg$/);
    });

    test("generates key with prefix", () => {
      const key = S3Service.generateKey("photo.jpg", "uploads");
      expect(key).toMatch(/^uploads\/\d+-[a-f0-9]+-photo\.jpg$/);
    });

    test("sanitizes special characters in filename", () => {
      const key = S3Service.generateKey("my photo (1).jpg");
      expect(key).toMatch(/my_photo__1_\.jpg$/);
    });

    test("preserves allowed characters", () => {
      const key = S3Service.generateKey("file-name.test.jpg");
      expect(key).toMatch(/file-name\.test\.jpg$/);
    });

    test("generates unique keys", () => {
      const key1 = S3Service.generateKey("photo.jpg");
      const key2 = S3Service.generateKey("photo.jpg");
      expect(key1).not.toBe(key2);
    });

    test("handles empty prefix", () => {
      const key = S3Service.generateKey("photo.jpg", "");
      expect(key).not.toContain("/");
    });

    test("handles filename with multiple dots", () => {
      const key = S3Service.generateKey("file.name.with.dots.jpg");
      expect(key).toMatch(/file\.name\.with\.dots\.jpg$/);
    });

    test("handles filename with numbers", () => {
      const key = S3Service.generateKey("photo123.jpg");
      expect(key).toMatch(/photo123\.jpg$/);
    });

    test("handles filename with uppercase", () => {
      const key = S3Service.generateKey("Photo.JPG");
      expect(key).toMatch(/Photo\.JPG$/);
    });

    test("sanitizes unicode characters", () => {
      const key = S3Service.generateKey("фото.jpg");
      expect(key).toMatch(/\.jpg$/);
      expect(key).not.toContain("ф");
    });

    test("handles very long filenames", () => {
      const longName = `${"a".repeat(200)}.jpg`;
      const key = S3Service.generateKey(longName);
      expect(key).toContain(".jpg");
    });

    test("handles filename with only extension", () => {
      const key = S3Service.generateKey(".gitignore");
      expect(key).toMatch(/\.gitignore$/);
    });

    test("handles filename with spaces", () => {
      const key = S3Service.generateKey("my file name.txt");
      expect(key).toMatch(/my_file_name\.txt$/);
    });

    test("handles nested prefix", () => {
      const key = S3Service.generateKey("photo.jpg", "uploads/2024/01");
      expect(key).toMatch(/^uploads\/2024\/01\/\d+-[a-f0-9]+-photo\.jpg$/);
    });
  });
});
