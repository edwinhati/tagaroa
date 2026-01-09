import { S3Client } from "bun";

export interface S3Config {
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	endpoint?: string;
	region?: string;
}

export interface S3File {
	write(
		data: string | ArrayBuffer | Blob | Response,
		options?: { type?: string },
	): Promise<void>;
	stat(): Promise<{
		size: number;
		type?: string;
		lastModified: Date;
		etag: string;
	}>;
	exists(): Promise<boolean>;
	delete(): Promise<void>;
	presign(options: {
		method: string;
		expiresIn?: number;
		type?: string;
		acl?: string;
	}): string;
}

export interface S3ClientInterface {
	file(key: string): S3File;
}

export class S3Service {
	private readonly client: S3ClientInterface;

	constructor(config: S3Config, client?: S3ClientInterface) {
		this.client =
			client ||
			new S3Client({
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
				bucket: config.bucket,
				endpoint: config.endpoint,
				region: config.region || "us-east-1",
			});
	}

	/**
	 * Upload a file to S3
	 */
	async upload(
		key: string,
		data: string | Uint8Array | ArrayBuffer | Blob | ReadableStream,
		options?: {
			contentType?: string;
			acl?: string;
		},
	): Promise<{ url: string; key: string }> {
		const file = this.client.file(key);

		// Convert data to compatible types for Bun's S3 write
		let uploadData: string | ArrayBuffer | Blob | Response;
		if (data instanceof ReadableStream) {
			uploadData = new Response(data);
		} else if (data instanceof Uint8Array) {
			// Convert Uint8Array to Blob for compatibility
			uploadData = new Blob([data as BlobPart]);
		} else {
			uploadData = data;
		}

		await file.write(uploadData, {
			type: options?.contentType || "application/octet-stream",
		});

		// Generate the URL for the uploaded file
		const url = this.getFileUrl(key);

		return { url, key };
	}

	/**
	 * Download a file from S3
	 */
	async download(key: string): Promise<S3File> {
		const file = this.client.file(key);
		// S3File extends Blob, so we can return it directly
		return file;
	}

	/**
	 * Get file metadata
	 */
	async stat(key: string): Promise<{
		size: number;
		contentType: string;
		lastModified: Date;
		etag: string;
	}> {
		const file = this.client.file(key);
		const stat = await file.stat();

		return {
			size: stat.size,
			contentType: stat.type || "application/octet-stream",
			lastModified: stat.lastModified,
			etag: stat.etag,
		};
	}

	/**
	 * Check if file exists
	 */
	async exists(key: string): Promise<boolean> {
		const file = this.client.file(key);
		return await file.exists();
	}

	/**
	 * Delete a file from S3
	 */
	async delete(key: string): Promise<void> {
		const file = this.client.file(key);
		await file.delete();
	}

	/**
	 * Generate a presigned URL for downloading
	 */
	presignDownload(
		key: string,
		options?: {
			expiresIn?: number; // seconds
		},
	): string {
		const file = this.client.file(key);
		return file.presign({
			method: "GET",
			expiresIn: options?.expiresIn || 3600, // 1 hour default
		});
	}

	/**
	 * Generate a presigned URL for uploading
	 */
	presignUpload(
		key: string,
		options?: {
			expiresIn?: number; // seconds
			contentType?: string;
			acl?: string;
		},
	): string {
		const file = this.client.file(key);
		return file.presign({
			method: "PUT",
			expiresIn: options?.expiresIn || 3600,
			type: options?.contentType,
			acl: options?.acl,
		});
	}

	/**
	 * Get the public URL for a file
	 */
	private getFileUrl(key: string): string {
		// Generate a presigned URL (7 days - maximum allowed)
		return this.presignDownload(key, { expiresIn: 60 * 60 * 24 * 7 });
	}

	/**
	 * Generate a unique key for a file
	 */
	static generateKey(originalName: string, prefix?: string): string {
		const timestamp = Date.now();
		const random = crypto.randomUUID().split("-")[0];
		const sanitized = originalName.replaceAll(/[^a-zA-Z0-9.-]/g, "_");
		const key = prefix
			? `${prefix}/${timestamp}-${random}-${sanitized}`
			: `${timestamp}-${random}-${sanitized}`;
		return key;
	}
}
