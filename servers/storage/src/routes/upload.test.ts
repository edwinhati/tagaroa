import { describe, expect, test, mock, beforeEach, spyOn } from "bun:test";
import { Hono } from "hono";
import { createUploadRoutes } from "./upload";
import type { File } from "../model/file";

// Suppress console.error during tests
spyOn(console, "error").mockImplementation(() => {});

// Create mock file service
const createMockFileService = () => ({
	uploadFile: mock(() =>
		Promise.resolve({
			file: {
				id: "123",
				url: "https://s3.com/file",
				key: "uploads/file.txt",
				size: 100,
				content_type: "text/plain",
				original_name: "file.txt",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			} as File,
			url: "https://s3.com/file",
		}),
	),
	getUploadUrl: mock(() =>
		Promise.resolve({
			url: "https://presigned-upload.com",
			key: "uploads/file.txt",
		}),
	),
});

describe("Upload Routes", () => {
	let app: Hono;
	let mockFileService: ReturnType<typeof createMockFileService>;

	beforeEach(() => {
		mockFileService = createMockFileService();
		const routes = createUploadRoutes(mockFileService as any);
		app = new Hono();
		app.route("/upload", routes);
	});

	describe("POST /upload", () => {
		test("uploads file successfully", async () => {
			const formData = new FormData();
			formData.append("file", new File(["test content"], "test.txt", { type: "text/plain" }));

			const res = await app.request("/upload", {
				method: "POST",
				body: formData,
			});
			const json = await res.json();

			expect(res.status).toBe(201);
			expect(json.success).toBe(true);
			expect(json.data.id).toBe("123");
			expect(json.data.url).toBe("https://s3.com/file");
		});

		test("uploads file with prefix", async () => {
			const formData = new FormData();
			formData.append("file", new File(["test content"], "test.txt", { type: "text/plain" }));
			formData.append("prefix", "documents");

			const res = await app.request("/upload", {
				method: "POST",
				body: formData,
			});

			expect(res.status).toBe(201);
			expect(mockFileService.uploadFile).toHaveBeenCalledWith(
				expect.objectContaining({
					prefix: "documents",
				}),
			);
		});

		test("returns 400 when no file provided", async () => {
			const formData = new FormData();

			const res = await app.request("/upload", {
				method: "POST",
				body: formData,
			});
			const json = await res.json();

			expect(res.status).toBe(400);
			expect(json.error).toBe("No file provided");
		});

		test("returns 400 when file field is not a File", async () => {
			const formData = new FormData();
			formData.append("file", "not a file");

			const res = await app.request("/upload", {
				method: "POST",
				body: formData,
			});
			const json = await res.json();

			expect(res.status).toBe(400);
			expect(json.error).toBe("No file provided");
		});

		test("handles upload errors", async () => {
			mockFileService.uploadFile.mockRejectedValue(new Error("S3 error"));

			const formData = new FormData();
			formData.append("file", new File(["test"], "test.txt"));

			const res = await app.request("/upload", {
				method: "POST",
				body: formData,
			});
			const json = await res.json();

			expect(res.status).toBe(500);
			expect(json.error).toBe("Upload failed");
		});
	});

	describe("POST /upload/presigned", () => {
		test("generates presigned upload URL", async () => {
			const res = await app.request("/upload/presigned", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					originalName: "test.txt",
					contentType: "text/plain",
					expiresIn: 3600,
					prefix: "uploads",
				}),
			});
			const json = await res.json();

			expect(res.status).toBe(200);
			expect(json.success).toBe(true);
			expect(json.data.url).toBe("https://presigned-upload.com");
			expect(json.data.key).toBe("uploads/file.txt");
		});

		test("generates presigned URL with minimal params", async () => {
			const res = await app.request("/upload/presigned", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					originalName: "test.txt",
				}),
			});
			const json = await res.json();

			expect(res.status).toBe(200);
			expect(json.success).toBe(true);
		});

		test("returns 400 when originalName missing", async () => {
			const res = await app.request("/upload/presigned", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});
			const json = await res.json();

			expect(res.status).toBe(400);
			expect(json.error).toBe("Missing originalName");
		});

		test("handles errors", async () => {
			mockFileService.getUploadUrl.mockRejectedValue(new Error("S3 error"));

			const res = await app.request("/upload/presigned", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ originalName: "test.txt" }),
			});
			const json = await res.json();

			expect(res.status).toBe(500);
			expect(json.error).toBe("Failed to generate presigned URL");
		});
	});

	describe("POST /upload/batch", () => {
		test("uploads multiple files successfully", async () => {
			const formData = new FormData();
			formData.append("files", new File(["content1"], "file1.txt", { type: "text/plain" }));
			formData.append("files", new File(["content2"], "file2.txt", { type: "text/plain" }));

			const res = await app.request("/upload/batch", {
				method: "POST",
				body: formData,
			});
			const json = await res.json();

			expect(res.status).toBe(201);
			expect(json.success).toBe(true);
			expect(json.data).toHaveLength(2);
		});

		test("uploads batch with prefix", async () => {
			const formData = new FormData();
			formData.append("files", new File(["content"], "file.txt"));
			formData.append("prefix", "batch");

			const res = await app.request("/upload/batch", {
				method: "POST",
				body: formData,
			});

			expect(res.status).toBe(201);
			expect(mockFileService.uploadFile).toHaveBeenCalledWith(
				expect.objectContaining({
					prefix: "batch",
				}),
			);
		});

		test("returns 400 when no files provided", async () => {
			const formData = new FormData();

			const res = await app.request("/upload/batch", {
				method: "POST",
				body: formData,
			});
			const json = await res.json();

			expect(res.status).toBe(400);
			expect(json.error).toBe("No files provided");
		});

		test("handles batch upload errors", async () => {
			mockFileService.uploadFile.mockRejectedValue(new Error("S3 error"));

			const formData = new FormData();
			formData.append("files", new File(["content"], "file.txt"));

			const res = await app.request("/upload/batch", {
				method: "POST",
				body: formData,
			});
			const json = await res.json();

			expect(res.status).toBe(500);
			expect(json.error).toBe("Batch upload failed");
		});

		test("handles invalid file in batch", async () => {
			const formData = new FormData();
			formData.append("files", "not a file");

			const res = await app.request("/upload/batch", {
				method: "POST",
				body: formData,
			});
			const json = await res.json();

			expect(res.status).toBe(500);
			expect(json.error).toBe("Batch upload failed");
		});
	});
});
