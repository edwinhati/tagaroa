import { Hono } from "hono";
import type { FileService } from "../service/file-service";

export const createUploadRoutes = (fileService: FileService) => {
	const app = new Hono();

	/**
	 * Upload a file
	 * POST /
	 */
	app.post("/", async (c) => {
		try {
			const formData = await c.req.formData();
			const file = formData.get("file");

			if (!file || !(file instanceof File)) {
				return c.json(
					{
						error: "No file provided",
						message: "Please provide a file in the 'file' field",
					},
					400,
				);
			}

			// Optional: Get prefix from form data
			const prefix = formData.get("prefix")?.toString();

			// Upload file
			const result = await fileService.uploadFile({
				file,
				originalName: file.name,
				contentType: file.type,
				prefix,
			});

			return c.json(
				{
					success: true,
					data: {
						id: result.file.id,
						url: result.url,
						key: result.file.key,
						size: result.file.size,
						contentType: result.file.content_type,
						originalName: result.file.original_name,
						createdAt: result.file.created_at,
					},
				},
				201,
			);
		} catch (error) {
			console.error("Upload error:", error);
			return c.json(
				{
					error: "Upload failed",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				500,
			);
		}
	});

	/**
	 * Get presigned upload URL
	 * POST /presigned
	 */
	app.post("/presigned", async (c) => {
		try {
			const body = await c.req.json();
			const { originalName, contentType, expiresIn, prefix } = body;

			if (!originalName) {
				return c.json(
					{
						error: "Missing originalName",
						message: "originalName is required",
					},
					400,
				);
			}

			const result = await fileService.getUploadUrl({
				originalName,
				contentType,
				expiresIn,
				prefix,
			});

			return c.json({
				success: true,
				data: {
					url: result.url,
					key: result.key,
					expiresIn: expiresIn || 3600,
				},
			});
		} catch (error) {
			console.error("Presigned URL error:", error);
			return c.json(
				{
					error: "Failed to generate presigned URL",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				500,
			);
		}
	});

	/**
	 * Upload multiple files
	 * POST /batch
	 */
	app.post("/batch", async (c) => {
		try {
			const formData = await c.req.formData();
			const files = formData.getAll("files");

			if (!files || files.length === 0) {
				return c.json(
					{
						error: "No files provided",
						message: "Please provide files in the 'files' field",
					},
					400,
				);
			}

			const prefix = formData.get("prefix")?.toString();

			// Upload all files
			const results = await Promise.all(
				files.map(async (file) => {
					if (!(file instanceof File)) {
						throw new Error("Invalid file in batch");
					}

					return await fileService.uploadFile({
						file,
						originalName: file.name,
						contentType: file.type,
						prefix,
					});
				}),
			);

			return c.json(
				{
					success: true,
					data: results.map((result) => ({
						id: result.file.id,
						url: result.url,
						key: result.file.key,
						size: result.file.size,
						contentType: result.file.content_type,
						originalName: result.file.original_name,
						createdAt: result.file.created_at,
					})),
				},
				201,
			);
		} catch (error) {
			console.error("Batch upload error:", error);
			return c.json(
				{
					error: "Batch upload failed",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				500,
			);
		}
	});

	return app;
};
