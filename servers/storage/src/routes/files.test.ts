import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { Hono } from "hono";
import type { File } from "../model/file";
import { createLoggerPort } from "../ports/logger.port";
import { createFileRoutes } from "./files";

spyOn(console, "error").mockImplementation(() => {});

const createMockFileService = () => ({
  getFile: mock(() => Promise.resolve(null as File | null)),
  getFileByKey: mock(() => Promise.resolve(null as File | null)),
  listFiles: mock(() => Promise.resolve({ files: [] as File[], total: 0 })),
  downloadFile: mock(() =>
    Promise.resolve(null as { blob: Blob; file: File } | null),
  ),
  getDownloadUrl: mock(() =>
    Promise.resolve(null as { url: string; file: File } | null),
  ),
  deleteFile: mock(() => Promise.resolve(false)),
  getStats: mock(() =>
    Promise.resolve({
      totalFiles: 0,
      totalSize: 0,
      byContentType: {} as Record<
        string,
        { count: number; total_size: number }
      >,
    }),
  ),
  uploadFile: mock(() => Promise.resolve({ file: {} as File, url: "" })),
  getUploadUrl: mock(() => Promise.resolve({ url: "", key: "" })),
  fileExists: mock(() => Promise.resolve(false)),
});

const mockLogger = createLoggerPort();

describe("File Routes", () => {
  let app: Hono;
  let mockFileService: ReturnType<typeof createMockFileService>;

  beforeEach(() => {
    mockFileService = createMockFileService();
    const routes = createFileRoutes(
      mockFileService as unknown as Parameters<typeof createFileRoutes>[0],
      mockLogger,
    );
    app = new Hono();
    app.route("/files", routes);
  });

  describe("GET /files", () => {
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

      mockFileService.listFiles.mockResolvedValue({ files, total: 1 });

      const res = await app.request("/files");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.pagination.total).toBe(1);
    });

    test("lists files with query params", async () => {
      mockFileService.listFiles.mockResolvedValue({ files: [], total: 0 });

      const res = await app.request(
        "/files?search=test&contentType=image/jpeg&limit=20&offset=10&orderBy=size%20DESC",
      );
      const _json = await res.json();

      expect(res.status).toBe(200);
      expect(mockFileService.listFiles).toHaveBeenCalledWith({
        search: "test",
        contentType: "image/jpeg",
        limit: 20,
        offset: 10,
        orderBy: "size DESC",
      });
    });

    test("returns hasMore correctly", async () => {
      mockFileService.listFiles.mockResolvedValue({ files: [], total: 100 });

      const res = await app.request("/files?limit=50&offset=0");
      const json = await res.json();

      expect(json.pagination.hasMore).toBe(true);
    });

    test("handles errors", async () => {
      mockFileService.listFiles.mockRejectedValue(new Error("Database error"));

      const res = await app.request("/files");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to list files");
    });
  });

  describe("GET /files/:id", () => {
    test("returns file when found", async () => {
      const file: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "file.txt",
        size: 100,
        content_type: "text/plain",
        original_name: "file.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFileService.getFile.mockResolvedValue(file);

      const res = await app.request("/files/123");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("123");
    });

    test("returns 404 when file not found", async () => {
      mockFileService.getFile.mockResolvedValue(null);

      const res = await app.request("/files/nonexistent");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("File not found");
    });

    test("handles errors", async () => {
      mockFileService.getFile.mockRejectedValue(new Error("Database error"));

      const res = await app.request("/files/123");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to get file");
    });
  });

  describe("GET /files/:id/download", () => {
    test("downloads file when found", async () => {
      const file: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "file.txt",
        size: 12,
        content_type: "text/plain",
        original_name: "test.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const blob = new Blob(["test content"], { type: "text/plain" });

      mockFileService.downloadFile.mockResolvedValue({ blob, file });

      const res = await app.request("/files/123/download");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/plain");
      expect(res.headers.get("Content-Disposition")).toBe(
        'attachment; filename="test.txt"',
      );
    });

    test("returns 404 when file not found", async () => {
      mockFileService.downloadFile.mockResolvedValue(null);

      const res = await app.request("/files/nonexistent/download");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("File not found");
    });

    test("handles errors", async () => {
      mockFileService.downloadFile.mockRejectedValue(new Error("S3 error"));

      const res = await app.request("/files/123/download");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to download file");
    });
  });

  describe("GET /files/:id/url", () => {
    test("returns presigned URL when file found", async () => {
      const file: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "file.txt",
        size: 100,
        content_type: "text/plain",
        original_name: "test.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFileService.getDownloadUrl.mockResolvedValue({
        url: "https://presigned.com",
        file,
      });

      const res = await app.request("/files/123/url");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.url).toBe("https://presigned.com");
      expect(json.data.expiresIn).toBe(3600);
    });

    test("uses custom expiresIn", async () => {
      const file: File = {
        id: "123",
        url: "https://s3.com/file",
        key: "file.txt",
        size: 100,
        content_type: "text/plain",
        original_name: "test.txt",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFileService.getDownloadUrl.mockResolvedValue({
        url: "https://presigned.com",
        file,
      });

      const res = await app.request("/files/123/url?expiresIn=7200");
      const json = await res.json();

      expect(json.data.expiresIn).toBe(7200);
      expect(mockFileService.getDownloadUrl).toHaveBeenCalledWith("123", 7200);
    });

    test("returns 404 when file not found", async () => {
      mockFileService.getDownloadUrl.mockResolvedValue(null);

      const res = await app.request("/files/nonexistent/url");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("File not found");
    });

    test("handles errors", async () => {
      mockFileService.getDownloadUrl.mockRejectedValue(new Error("S3 error"));

      const res = await app.request("/files/123/url");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to generate download URL");
    });
  });

  describe("DELETE /files/:id", () => {
    test("deletes file when found", async () => {
      mockFileService.deleteFile.mockResolvedValue(true);

      const res = await app.request("/files/123", { method: "DELETE" });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe("File deleted successfully");
    });

    test("returns 404 when file not found", async () => {
      mockFileService.deleteFile.mockResolvedValue(false);

      const res = await app.request("/files/nonexistent", { method: "DELETE" });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("File not found");
    });

    test("handles errors", async () => {
      mockFileService.deleteFile.mockRejectedValue(new Error("Database error"));

      const res = await app.request("/files/123", { method: "DELETE" });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to delete file");
    });
  });

  describe("GET /files/stats", () => {
    test("returns file statistics", async () => {
      const stats = {
        totalFiles: 100,
        totalSize: 1024000,
        byContentType: {
          "image/jpeg": { count: 50, total_size: 512000 },
          "image/png": { count: 50, total_size: 512000 },
        },
      };

      mockFileService.getStats.mockResolvedValue(stats);

      const res = await app.request("/files/stats");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.totalFiles).toBe(100);
    });

    test("handles errors", async () => {
      mockFileService.getStats.mockRejectedValue(new Error("Database error"));

      const res = await app.request("/files/stats");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to get statistics");
    });
  });
});
