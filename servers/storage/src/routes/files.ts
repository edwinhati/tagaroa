import { Hono } from "hono";
import type { FileService } from "../service/file-service";

export const createFileRoutes = (fileService: FileService) => {
	const app = new Hono();

	/**
	 * List files
	 * GET /files
	 */
	app.get("/", async (c) => {
		try {
			const search = c.req.query("search");
			const contentType = c.req.query("contentType");
			const limit = Number.parseInt(c.req.query("limit") || "50", 10);
			const offset = Number.parseInt(c.req.query("offset") || "0", 10);
			const orderBy = c.req.query("orderBy") || "created_at DESC";

			const result = await fileService.listFiles({
				search,
				contentType,
				limit,
				offset,
				orderBy,
			});

			return c.json({
				success: true,
				data: result.files,
				pagination: {
					total: result.total,
					limit,
					offset,
					hasMore: offset + limit < result.total,
				},
			});
		} catch (error) {
			console.error("List files error:", error);
			return c.json(
				{
					error: "Failed to list files",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				500,
			);
		}
	});

	/**
	 * Get file statistics
	 * GET /files/stats
	 * NOTE: This must be defined before /:id to avoid being matched by the wildcard
	 */
	app.get("/stats", async (c) => {
		try {
			const stats = await fileService.getStats();

			return c.json({
				success: true,
				data: stats,
			});
		} catch (error) {
			console.error("Get stats error:", error);
			return c.json(
				{
					error: "Failed to get statistics",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				500,
			);
		}
	});

	/**
	 * Get file by ID
	 * GET /files/:id
	 */
	app.get("/:id", async (c) => {
		try {
			const id = c.req.param("id");
			const file = await fileService.getFile(id);

			if (!file) {
				return c.json(
					{
						error: "File not found",
						message: `File with ID ${id} not found`,
					},
					404,
				);
			}

			return c.json({
				success: true,
				data: file,
			});
		} catch (error) {
			console.error("Get file error:", error);
			return c.json(
				{
					error: "Failed to get file",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				500,
			);
		}
	});

	/**
	 * Download file
	 * GET /files/:id/download
	 */
	app.get("/:id/download", async (c) => {
		try {
			const id = c.req.param("id");
			const result = await fileService.downloadFile(id);

			if (!result) {
				return c.json(
					{
						error: "File not found",
						message: `File with ID ${id} not found`,
					},
					404,
				);
			}

			// Set headers for download
			c.header("Content-Type", result.file.content_type);
			c.header(
				"Content-Disposition",
				`attachment; filename="${result.file.original_name}"`,
			);
			c.header("Content-Length", result.file.size.toString());

			return c.body(await result.blob.arrayBuffer());
		} catch (error) {
			console.error("Download file error:", error);
			return c.json(
				{
					error: "Failed to download file",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				500,
			);
		}
	});

	/**
	 * Get presigned download URL
	 * GET /files/:id/url
	 */
	app.get("/:id/url", async (c) => {
		try {
			const id = c.req.param("id");
			const expiresIn = Number.parseInt(c.req.query("expiresIn") || "3600", 10);

			const result = await fileService.getDownloadUrl(id, expiresIn);

			if (!result) {
				return c.json(
					{
						error: "File not found",
						message: `File with ID ${id} not found`,
					},
					404,
				);
			}

			return c.json({
				success: true,
				data: {
					url: result.url,
					expiresIn,
					file: {
						id: result.file.id,
						originalName: result.file.original_name,
						contentType: result.file.content_type,
						size: result.file.size,
					},
				},
			});
		} catch (error) {
			console.error("Get download URL error:", error);
			return c.json(
				{
					error: "Failed to generate download URL",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				500,
			);
		}
	});

	/**
	 * Delete file
	 * DELETE /files/:id
	 */
	app.delete("/:id", async (c) => {
		try {
			const id = c.req.param("id");
			const deleted = await fileService.deleteFile(id);

			if (!deleted) {
				return c.json(
					{
						error: "File not found",
						message: `File with ID ${id} not found`,
					},
					404,
				);
			}

			return c.json({
				success: true,
				message: "File deleted successfully",
			});
		} catch (error) {
			console.error("Delete file error:", error);
			return c.json(
				{
					error: "Failed to delete file",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				500,
			);
		}
	});

	return app;
};
