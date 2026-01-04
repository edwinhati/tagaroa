import { describe, expect, test, mock, beforeEach } from "bun:test";
import { FileRepository } from "./file-repository";
import type { File, CreateFileInput } from "../model/file";

// Mock SQL database
const createMockDb = () => {
	const mockDb = mock(() => Promise.resolve([]));
	mockDb.unsafe = mock(() => Promise.resolve([]));
	return mockDb as any;
};

describe("FileRepository", () => {
	let repository: FileRepository;
	let mockDb: ReturnType<typeof createMockDb>;

	beforeEach(() => {
		mockDb = createMockDb();
		repository = new FileRepository(mockDb);
	});

	describe("create", () => {
		test("creates a file with provided id", async () => {
			const input: CreateFileInput = {
				id: "custom-id",
				url: "https://example.com/file.jpg",
				key: "uploads/file.jpg",
				size: 1024,
				content_type: "image/jpeg",
				original_name: "photo.jpg",
			};

			const expectedFile: File = {
				...input,
				id: "custom-id",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.mockImplementation(() => Promise.resolve([expectedFile]));

			const result = await repository.create(input);

			expect(result).toEqual(expectedFile);
		});

		test("creates a file with generated id when not provided", async () => {
			const input: CreateFileInput = {
				url: "https://example.com/file.jpg",
				key: "uploads/file.jpg",
				size: 1024,
				content_type: "image/jpeg",
				original_name: "photo.jpg",
			};

			const expectedFile: File = {
				...input,
				id: "generated-uuid",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.mockImplementation(() => Promise.resolve([expectedFile]));

			const result = await repository.create(input);

			expect(result.url).toBe(input.url);
			expect(result.key).toBe(input.key);
		});
	});

	describe("findUnique", () => {
		test("finds file by id", async () => {
			const expectedFile: File = {
				id: "123",
				url: "https://example.com/file.jpg",
				key: "uploads/file.jpg",
				size: 1024,
				content_type: "image/jpeg",
				original_name: "photo.jpg",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.unsafe.mockImplementation(() => Promise.resolve([expectedFile]));

			const result = await repository.findUnique({ where: { id: "123" } });

			expect(result).toEqual(expectedFile);
		});

		test("finds file by key", async () => {
			const expectedFile: File = {
				id: "123",
				url: "https://example.com/file.jpg",
				key: "uploads/file.jpg",
				size: 1024,
				content_type: "image/jpeg",
				original_name: "photo.jpg",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.unsafe.mockImplementation(() => Promise.resolve([expectedFile]));

			const result = await repository.findUnique({
				where: { key: "uploads/file.jpg" },
			});

			expect(result).toEqual(expectedFile);
		});

		test("finds file by url", async () => {
			const expectedFile: File = {
				id: "123",
				url: "https://example.com/file.jpg",
				key: "uploads/file.jpg",
				size: 1024,
				content_type: "image/jpeg",
				original_name: "photo.jpg",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.unsafe.mockImplementation(() => Promise.resolve([expectedFile]));

			const result = await repository.findUnique({
				where: { url: "https://example.com/file.jpg" },
			});

			expect(result).toEqual(expectedFile);
		});

		test("returns null when file not found", async () => {
			mockDb.unsafe.mockImplementation(() => Promise.resolve([]));

			const result = await repository.findUnique({
				where: { id: "nonexistent" },
			});

			expect(result).toBeNull();
		});

		test("finds file with search", async () => {
			const expectedFile: File = {
				id: "123",
				url: "https://example.com/file.jpg",
				key: "uploads/file.jpg",
				size: 1024,
				content_type: "image/jpeg",
				original_name: "photo.jpg",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.unsafe.mockImplementation(() => Promise.resolve([expectedFile]));

			const result = await repository.findUnique({
				where: { search: "photo" },
			});

			expect(result).toEqual(expectedFile);
		});
	});

	describe("findMany", () => {
		test("finds multiple files with default params", async () => {
			const files: File[] = [
				{
					id: "1",
					url: "https://example.com/file1.jpg",
					key: "uploads/file1.jpg",
					size: 1024,
					content_type: "image/jpeg",
					original_name: "photo1.jpg",
					deleted_at: null,
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					id: "2",
					url: "https://example.com/file2.jpg",
					key: "uploads/file2.jpg",
					size: 2048,
					content_type: "image/png",
					original_name: "photo2.png",
					deleted_at: null,
					created_at: new Date(),
					updated_at: new Date(),
				},
			];

			mockDb.unsafe.mockImplementation(() => Promise.resolve(files));

			const result = await repository.findMany({});

			expect(result).toEqual(files);
			expect(result.length).toBe(2);
		});

		test("finds files with search filter", async () => {
			const files: File[] = [
				{
					id: "1",
					url: "https://example.com/file1.jpg",
					key: "uploads/file1.jpg",
					size: 1024,
					content_type: "image/jpeg",
					original_name: "photo1.jpg",
					deleted_at: null,
					created_at: new Date(),
					updated_at: new Date(),
				},
			];

			mockDb.unsafe.mockImplementation(() => Promise.resolve(files));

			const result = await repository.findMany({
				where: { search: "photo" },
			});

			expect(result).toEqual(files);
		});

		test("finds files with content_type filter", async () => {
			const files: File[] = [
				{
					id: "1",
					url: "https://example.com/file1.jpg",
					key: "uploads/file1.jpg",
					size: 1024,
					content_type: "image/jpeg",
					original_name: "photo1.jpg",
					deleted_at: null,
					created_at: new Date(),
					updated_at: new Date(),
				},
			];

			mockDb.unsafe.mockImplementation(() => Promise.resolve(files));

			const result = await repository.findMany({
				where: { content_type: "image/jpeg" },
			});

			expect(result).toEqual(files);
		});

		test("finds files with pagination", async () => {
			mockDb.unsafe.mockImplementation(() => Promise.resolve([]));

			await repository.findMany({
				offset: 10,
				limit: 20,
			});

			expect(mockDb.unsafe).toHaveBeenCalled();
		});

		test("finds files with custom orderBy", async () => {
			mockDb.unsafe.mockImplementation(() => Promise.resolve([]));

			await repository.findMany({
				orderBy: "size DESC",
			});

			expect(mockDb.unsafe).toHaveBeenCalled();
		});

		test("throws error for invalid orderBy column", async () => {
			await expect(
				repository.findMany({
					orderBy: "invalid_column DESC",
				}),
			).rejects.toThrow("Invalid ORDER BY column");
		});

		test("throws error for invalid orderBy direction", async () => {
			await expect(
				repository.findMany({
					orderBy: "size INVALID",
				}),
			).rejects.toThrow("Invalid ORDER BY direction");
		});

		test("validates all allowed orderBy columns", async () => {
			const allowedColumns = [
				"id",
				"url",
				"key",
				"size",
				"content_type",
				"original_name",
				"created_at",
				"updated_at",
			];

			for (const column of allowedColumns) {
				mockDb.unsafe.mockImplementation(() => Promise.resolve([]));
				// Just verify it doesn't throw an error for valid columns
				const result = await repository.findMany({ orderBy: `${column} ASC` });
				expect(result).toEqual([]);
			}
		});
	});

	describe("count", () => {
		test("counts all files", async () => {
			mockDb.unsafe.mockImplementation(() => Promise.resolve([{ count: 10 }]));

			const result = await repository.count();

			expect(result).toBe(10);
		});

		test("counts files with filter", async () => {
			mockDb.unsafe.mockImplementation(() => Promise.resolve([{ count: 5 }]));

			const result = await repository.count({ content_type: "image/jpeg" });

			expect(result).toBe(5);
		});
	});

	describe("update", () => {
		test("updates file url", async () => {
			const updatedFile: File = {
				id: "123",
				url: "https://new-url.com/file.jpg",
				key: "uploads/file.jpg",
				size: 1024,
				content_type: "image/jpeg",
				original_name: "photo.jpg",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.unsafe.mockImplementation(() => Promise.resolve([updatedFile]));

			const result = await repository.update("123", {
				url: "https://new-url.com/file.jpg",
			});

			expect(result).toEqual(updatedFile);
		});

		test("updates file key", async () => {
			const updatedFile: File = {
				id: "123",
				url: "https://example.com/file.jpg",
				key: "new-key.jpg",
				size: 1024,
				content_type: "image/jpeg",
				original_name: "photo.jpg",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.unsafe.mockImplementation(() => Promise.resolve([updatedFile]));

			const result = await repository.update("123", { key: "new-key.jpg" });

			expect(result).toEqual(updatedFile);
		});

		test("updates file size", async () => {
			const updatedFile: File = {
				id: "123",
				url: "https://example.com/file.jpg",
				key: "uploads/file.jpg",
				size: 2048,
				content_type: "image/jpeg",
				original_name: "photo.jpg",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.unsafe.mockImplementation(() => Promise.resolve([updatedFile]));

			const result = await repository.update("123", { size: 2048 });

			expect(result).toEqual(updatedFile);
		});

		test("updates file content_type", async () => {
			const updatedFile: File = {
				id: "123",
				url: "https://example.com/file.jpg",
				key: "uploads/file.jpg",
				size: 1024,
				content_type: "image/png",
				original_name: "photo.jpg",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.unsafe.mockImplementation(() => Promise.resolve([updatedFile]));

			const result = await repository.update("123", {
				content_type: "image/png",
			});

			expect(result).toEqual(updatedFile);
		});

		test("updates file original_name", async () => {
			const updatedFile: File = {
				id: "123",
				url: "https://example.com/file.jpg",
				key: "uploads/file.jpg",
				size: 1024,
				content_type: "image/jpeg",
				original_name: "new-name.jpg",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.unsafe.mockImplementation(() => Promise.resolve([updatedFile]));

			const result = await repository.update("123", {
				original_name: "new-name.jpg",
			});

			expect(result).toEqual(updatedFile);
		});

		test("updates file deleted_at", async () => {
			const deletedAt = new Date();
			const updatedFile: File = {
				id: "123",
				url: "https://example.com/file.jpg",
				key: "uploads/file.jpg",
				size: 1024,
				content_type: "image/jpeg",
				original_name: "photo.jpg",
				deleted_at: deletedAt,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.unsafe.mockImplementation(() => Promise.resolve([updatedFile]));

			const result = await repository.update("123", { deleted_at: deletedAt });

			expect(result).toEqual(updatedFile);
		});

		test("returns null when file not found", async () => {
			mockDb.unsafe.mockImplementation(() => Promise.resolve([]));

			const result = await repository.update("nonexistent", {
				url: "https://new-url.com",
			});

			expect(result).toBeNull();
		});

		test("returns existing file when no updates provided", async () => {
			const existingFile: File = {
				id: "123",
				url: "https://example.com/file.jpg",
				key: "uploads/file.jpg",
				size: 1024,
				content_type: "image/jpeg",
				original_name: "photo.jpg",
				deleted_at: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.unsafe.mockImplementation(() => Promise.resolve([existingFile]));

			const result = await repository.update("123", {});

			expect(result).toEqual(existingFile);
		});
	});

	describe("softDelete", () => {
		test("soft deletes a file", async () => {
			const deletedFile: File = {
				id: "123",
				url: "https://example.com/file.jpg",
				key: "uploads/file.jpg",
				size: 1024,
				content_type: "image/jpeg",
				original_name: "photo.jpg",
				deleted_at: new Date(),
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockDb.unsafe.mockImplementation(() => Promise.resolve([deletedFile]));

			const result = await repository.softDelete("123");

			expect(result).toBe(true);
		});

		test("returns false when file not found", async () => {
			mockDb.unsafe.mockImplementation(() => Promise.resolve([]));

			const result = await repository.softDelete("nonexistent");

			expect(result).toBe(false);
		});
	});

	describe("getContentTypeAggregations", () => {
		test("returns aggregations by content type", async () => {
			const rows = [
				{ key: "image/jpeg", count: "10", total_size: "10240" },
				{ key: "image/png", count: "5", total_size: "5120" },
			];

			mockDb.unsafe.mockImplementation(() => Promise.resolve(rows));

			const result = await repository.getContentTypeAggregations();

			expect(result["image/jpeg"]).toEqual({ count: 10, total_size: 10240 });
			expect(result["image/png"]).toEqual({ count: 5, total_size: 5120 });
		});

		test("returns empty object when no files", async () => {
			mockDb.unsafe.mockImplementation(() => Promise.resolve([]));

			const result = await repository.getContentTypeAggregations();

			expect(result).toEqual({});
		});

		test("returns aggregations with filter", async () => {
			const rows = [{ key: "image/jpeg", count: "3", total_size: "3072" }];

			mockDb.unsafe.mockImplementation(() => Promise.resolve(rows));

			const result = await repository.getContentTypeAggregations({
				search: "photo",
			});

			expect(result["image/jpeg"]).toEqual({ count: 3, total_size: 3072 });
		});
	});

	describe("buildWhere", () => {
		test("builds where clause with multiple conditions", async () => {
			mockDb.unsafe.mockImplementation(() => Promise.resolve([]));

			await repository.findMany({
				where: {
					search: "test",
					content_type: "image/jpeg",
				},
			});

			expect(mockDb.unsafe).toHaveBeenCalled();
		});

		test("builds empty where clause", async () => {
			mockDb.unsafe.mockImplementation(() => Promise.resolve([]));

			await repository.findMany({});

			expect(mockDb.unsafe).toHaveBeenCalled();
		});
	});
});
