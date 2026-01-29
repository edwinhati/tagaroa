import { S3Client } from "bun";
import type { LoggerPort } from "../ports/logger.port.js";

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
  private readonly logger: LoggerPort;

  constructor(
    config: S3Config,
    logger: LoggerPort,
    client?: S3ClientInterface,
  ) {
    this.logger = logger;
    this.client =
      client ||
      new S3Client({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        bucket: config.bucket,
        endpoint: config.endpoint,
        region: config.region || "us-east-1",
      });

    logger.info(
      `S3Service initialized - bucket:${config.bucket} region:${config.region || "us-east-1"}`,
    );
  }

  async upload(
    key: string,
    data: string | Uint8Array | ArrayBuffer | Blob | ReadableStream,
    options?: {
      contentType?: string;
      acl?: string;
    },
  ): Promise<{ url: string; key: string }> {
    const ctx = "S3Service";
    this.logger.debug(`Uploading file - key:${key}`, ctx);

    const file = this.client.file(key);

    let uploadData: string | ArrayBuffer | Blob | Response;
    if (data instanceof ReadableStream) {
      uploadData = new Response(data);
    } else if (data instanceof Uint8Array) {
      uploadData = new Blob([data as BlobPart]);
    } else {
      uploadData = data;
    }

    await file.write(uploadData, {
      type: options?.contentType || "application/octet-stream",
    });

    const url = this.getFileUrl(key);

    this.logger.info(`Uploaded file - key:${key} url:${url}`, ctx);

    return { url, key };
  }

  async download(key: string): Promise<S3File> {
    const ctx = "S3Service";
    this.logger.debug(`Downloading file - key:${key}`, ctx);
    const file = this.client.file(key);
    return file;
  }

  async stat(key: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
    etag: string;
  }> {
    const ctx = "S3Service";
    this.logger.debug(`Getting file stats - key:${key}`, ctx);
    const file = this.client.file(key);
    const stat = await file.stat();

    return {
      size: stat.size,
      contentType: stat.type || "application/octet-stream",
      lastModified: stat.lastModified,
      etag: stat.etag,
    };
  }

  async exists(key: string): Promise<boolean> {
    const ctx = "S3Service";
    this.logger.debug(`Checking if file exists - key:${key}`, ctx);
    const file = this.client.file(key);
    return await file.exists();
  }

  async delete(key: string): Promise<void> {
    const ctx = "S3Service";
    this.logger.debug(`Deleting file - key:${key}`, ctx);
    const file = this.client.file(key);
    await file.delete();
    this.logger.info(`Deleted file - key:${key}`, ctx);
  }

  presignDownload(
    key: string,
    options?: {
      expiresIn?: number;
    },
  ): string {
    const ctx = "S3Service";
    this.logger.debug(
      `Generating presigned download URL - key:${key} expiresIn:${options?.expiresIn || 3600}`,
      ctx,
    );
    const file = this.client.file(key);
    return file.presign({
      method: "GET",
      expiresIn: options?.expiresIn || 3600,
    });
  }

  presignUpload(
    key: string,
    options?: {
      expiresIn?: number;
      contentType?: string;
      acl?: string;
    },
  ): string {
    const ctx = "S3Service";
    this.logger.debug(
      `Generating presigned upload URL - key:${key} expiresIn:${options?.expiresIn || 3600}`,
      ctx,
    );
    const file = this.client.file(key);
    return file.presign({
      method: "PUT",
      expiresIn: options?.expiresIn || 3600,
      type: options?.contentType,
      acl: options?.acl,
    });
  }

  private getFileUrl(key: string): string {
    return this.presignDownload(key, { expiresIn: 60 * 60 * 24 * 7 });
  }

  static generateKey(originalName: string, prefix?: string): string {
    const timestamp = Date.now();
    const random = crypto.randomUUID().split("-")[0];
    const sanitized = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = prefix
      ? `${prefix}/${timestamp}-${random}-${sanitized}`
      : `${timestamp}-${random}-${sanitized}`;
    return key;
  }
}
