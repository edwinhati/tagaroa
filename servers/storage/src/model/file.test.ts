import { describe, expect, test } from "bun:test";
import type { File, CreateFileInput, UpdateFileInput } from "./file";

describe("File model types", () => {
	test("File interface has correct structure", () => {
		const file: File = {
			id: "123e4567-e89b-12d3-a456-426614174000",
			url: "https://example.com/file.jpg",
			key: "uploads/file.jpg",
			size: 1024,
			content_type: "image/jpeg",
			original_name: "photo.jpg",
			deleted_at: null,
			created_at: new Date(),
			updated_at: new Date(),
		};

		expect(file.id).toBe("123e4567-e89b-12d3-a456-426614174000");
		expect(file.url).toBe("https://example.com/file.jpg");
		expect(file.key).toBe("uploads/file.jpg");
		expect(file.size).toBe(1024);
		expect(file.content_type).toBe("image/jpeg");
		expect(file.original_name).toBe("photo.jpg");
		expect(file.deleted_at).toBeNull();
		expect(file.created_at).toBeInstanceOf(Date);
		expect(file.updated_at).toBeInstanceOf(Date);
	});

	test("File interface allows deleted_at to be Date", () => {
		const deletedAt = new Date();
		const file: File = {
			id: "123",
			url: "https://example.com/file.jpg",
			key: "file.jpg",
			size: 100,
			content_type: "image/jpeg",
			original_name: "photo.jpg",
			deleted_at: deletedAt,
			created_at: new Date(),
			updated_at: new Date(),
		};

		expect(file.deleted_at).toBe(deletedAt);
	});

	test("CreateFileInput has correct structure", () => {
		const input: CreateFileInput = {
			url: "https://example.com/file.jpg",
			key: "uploads/file.jpg",
			size: 2048,
			content_type: "image/png",
			original_name: "image.png",
		};

		expect(input.url).toBe("https://example.com/file.jpg");
		expect(input.key).toBe("uploads/file.jpg");
		expect(input.size).toBe(2048);
		expect(input.content_type).toBe("image/png");
		expect(input.original_name).toBe("image.png");
		expect(input.id).toBeUndefined();
	});

	test("CreateFileInput allows optional id", () => {
		const input: CreateFileInput = {
			id: "custom-id",
			url: "https://example.com/file.jpg",
			key: "uploads/file.jpg",
			size: 2048,
			content_type: "image/png",
			original_name: "image.png",
		};

		expect(input.id).toBe("custom-id");
	});

	test("UpdateFileInput allows partial updates", () => {
		const input: UpdateFileInput = {
			url: "https://new-url.com/file.jpg",
		};

		expect(input.url).toBe("https://new-url.com/file.jpg");
		expect(input.key).toBeUndefined();
		expect(input.size).toBeUndefined();
	});

	test("UpdateFileInput allows all fields", () => {
		const deletedAt = new Date();
		const input: UpdateFileInput = {
			url: "https://new-url.com/file.jpg",
			key: "new-key.jpg",
			size: 4096,
			content_type: "image/gif",
			original_name: "animation.gif",
			deleted_at: deletedAt,
		};

		expect(input.url).toBe("https://new-url.com/file.jpg");
		expect(input.key).toBe("new-key.jpg");
		expect(input.size).toBe(4096);
		expect(input.content_type).toBe("image/gif");
		expect(input.original_name).toBe("animation.gif");
		expect(input.deleted_at).toBe(deletedAt);
	});

	test("UpdateFileInput allows null deleted_at", () => {
		const input: UpdateFileInput = {
			deleted_at: null,
		};

		expect(input.deleted_at).toBeNull();
	});
});
