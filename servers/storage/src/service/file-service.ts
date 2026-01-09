import type { CreateFileInput, File } from "../model/file";
import type { FileRepository } from "../repository/file-repository";
import { S3Service } from "./s3-service";

export interface UploadFileInput {
	file: Blob;
	originalName: string;
	contentType?: string;
	prefix?: string;
}

export interface UploadResult {
	file: File;
	url: string;
}

export class FileService {
	constructor(
		private readonly fileRepository: FileRepository,
		private readonly s3Service: S3Service,
	) {}

	/**
	 * Upload a file to S3 and save metadata to database
	 */
	async uploadFile(input: UploadFileInput): Promise<UploadResult> {
		// Generate unique key for S3
		const key = S3Service.generateKey(input.originalName, input.prefix);

		// Get file size
		const size = input.file.size;

		// Determine content type
		const contentType =
			input.contentType || input.file.type || "application/octet-stream";

		// Upload to S3
		const { url } = await this.s3Service.upload(key, input.file, {
			contentType,
		});

		// Save metadata to database
		const fileInput: CreateFileInput = {
			url,
			key,
			size,
			content_type: contentType,
			original_name: input.originalName,
		};

		const file = await this.fileRepository.create(fileInput);

		return {
			file,
			url,
		};
	}

	/**
	 * Get file by ID
	 */
	async getFile(id: string): Promise<File | null> {
		return await this.fileRepository.findUnique({ where: { id } });
	}

	/**
	 * Get file by key
	 */
	async getFileByKey(key: string): Promise<File | null> {
		return await this.fileRepository.findUnique({ where: { key } });
	}

	/**
	 * List files with pagination
	 */
	async listFiles(params: {
		search?: string;
		contentType?: string;
		limit?: number;
		offset?: number;
		orderBy?: string;
	}): Promise<{ files: File[]; total: number }> {
		const { search, contentType, limit = 50, offset = 0, orderBy } = params;

		const where: Record<string, unknown> = {};
		if (search) where.search = search;
		if (contentType) where.content_type = contentType;

		const [files, total] = await Promise.all([
			this.fileRepository.findMany({
				where,
				limit,
				offset,
				orderBy,
			}),
			this.fileRepository.count(where),
		]);

		return { files, total };
	}

	/**
	 * Download file from S3
	 */
	async downloadFile(id: string): Promise<{ blob: Blob; file: File } | null> {
		const file = await this.fileRepository.findUnique({ where: { id } });
		if (!file) return null;

		const blob = await this.s3Service.download(file.key);

		return { blob, file };
	}

	/**
	 * Generate presigned download URL
	 */
	async getDownloadUrl(
		id: string,
		expiresIn?: number,
	): Promise<{ url: string; file: File } | null> {
		const file = await this.fileRepository.findUnique({ where: { id } });
		if (!file) return null;

		const url = this.s3Service.presignDownload(file.key, { expiresIn });

		return { url, file };
	}

	/**
	 * Generate presigned upload URL
	 */
	async getUploadUrl(params: {
		originalName: string;
		contentType?: string;
		expiresIn?: number;
		prefix?: string;
	}): Promise<{ url: string; key: string }> {
		const key = S3Service.generateKey(params.originalName, params.prefix);

		const url = this.s3Service.presignUpload(key, {
			expiresIn: params.expiresIn,
			contentType: params.contentType,
		});

		return { url, key };
	}

	/**
	 * Delete file (soft delete in DB, hard delete in S3)
	 */
	async deleteFile(id: string): Promise<boolean> {
		const file = await this.fileRepository.findUnique({ where: { id } });
		if (!file) return false;

		// Soft delete in database
		const deleted = await this.fileRepository.softDelete(id);

		// Hard delete from S3 (optional - you might want to keep files in S3)
		if (deleted) {
			try {
				await this.s3Service.delete(file.key);
			} catch (error) {
				console.error("Failed to delete file from S3:", error);
				// Continue even if S3 deletion fails
			}
		}

		return deleted;
	}

	/**
	 * Check if file exists
	 */
	async fileExists(id: string): Promise<boolean> {
		const file = await this.fileRepository.findUnique({ where: { id } });
		return file !== null;
	}

	/**
	 * Get file statistics
	 */
	async getStats(): Promise<{
		totalFiles: number;
		totalSize: number;
		byContentType: Record<string, { count: number; total_size: number }>;
	}> {
		const [totalFiles, byContentType] = await Promise.all([
			this.fileRepository.count(),
			this.fileRepository.getContentTypeAggregations(),
		]);

		const totalSize = Object.values(byContentType).reduce(
			(sum, stat) => sum + stat.total_size,
			0,
		);

		return {
			totalFiles,
			totalSize,
			byContentType,
		};
	}
}
