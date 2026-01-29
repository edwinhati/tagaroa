import type { CreateFileInput, File } from "../model/file";
import type { LoggerPort } from "../ports/logger.port.js";
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
  private readonly fileRepository: FileRepository;
  private readonly s3Service: S3Service;
  private readonly logger: LoggerPort;

  constructor(
    fileRepository: FileRepository,
    s3Service: S3Service,
    logger: LoggerPort,
  ) {
    this.fileRepository = fileRepository;
    this.s3Service = s3Service;
    this.logger = logger;
  }

  async uploadFile(input: UploadFileInput): Promise<UploadResult> {
    const ctx = "FileService";
    this.logger.info(
      `Uploading file - name:${input.originalName} size:${input.file.size}`,
      ctx,
    );

    const key = S3Service.generateKey(input.originalName, input.prefix);
    const size = input.file.size;
    const contentType =
      input.contentType || input.file.type || "application/octet-stream";

    const { url } = await this.s3Service.upload(key, input.file, {
      contentType,
    });

    const fileInput: CreateFileInput = {
      url,
      key,
      size,
      content_type: contentType,
      original_name: input.originalName,
    };

    const file = await this.fileRepository.create(fileInput);

    this.logger.info(`Uploaded file - id:${file.id} key:${key}`, ctx);

    return {
      file,
      url,
    };
  }

  async getFile(id: string): Promise<File | null> {
    const ctx = "FileService";
    this.logger.debug(`Getting file - id:${id}`, ctx);
    return await this.fileRepository.findUnique({ where: { id } });
  }

  async getFileByKey(key: string): Promise<File | null> {
    const ctx = "FileService";
    this.logger.debug(`Getting file by key - key:${key}`, ctx);
    return await this.fileRepository.findUnique({ where: { key } });
  }

  async listFiles(params: {
    search?: string;
    contentType?: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
  }): Promise<{ files: File[]; total: number }> {
    const ctx = "FileService";
    this.logger.debug(`Listing files - params:${JSON.stringify(params)}`, ctx);

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

    this.logger.debug(
      `Listed files - count:${files.length} total:${total}`,
      ctx,
    );

    return { files, total };
  }

  async downloadFile(id: string): Promise<{ blob: Blob; file: File } | null> {
    const ctx = "FileService";
    this.logger.debug(`Downloading file - id:${id}`, ctx);

    const file = await this.fileRepository.findUnique({ where: { id } });
    if (!file) return null;

    const blob = await this.s3Service.download(file.key);

    return { blob, file };
  }

  async getDownloadUrl(
    id: string,
    expiresIn?: number,
  ): Promise<{ url: string; file: File } | null> {
    const ctx = "FileService";
    this.logger.debug(
      `Getting download URL - id:${id} expiresIn:${expiresIn}`,
      ctx,
    );

    const file = await this.fileRepository.findUnique({ where: { id } });
    if (!file) return null;

    const url = this.s3Service.presignDownload(file.key, { expiresIn });

    return { url, file };
  }

  async getUploadUrl(params: {
    originalName: string;
    contentType?: string;
    expiresIn?: number;
    prefix?: string;
  }): Promise<{ url: string; key: string }> {
    const ctx = "FileService";
    this.logger.debug(`Getting upload URL - name:${params.originalName}`, ctx);

    const key = S3Service.generateKey(params.originalName, params.prefix);
    const url = this.s3Service.presignUpload(key, {
      expiresIn: params.expiresIn,
      contentType: params.contentType,
    });

    return { url, key };
  }

  async deleteFile(id: string): Promise<boolean> {
    const ctx = "FileService";
    this.logger.info(`Deleting file - id:${id}`, ctx);

    const file = await this.fileRepository.findUnique({ where: { id } });
    if (!file) return false;

    const deleted = await this.fileRepository.softDelete(id);

    if (deleted) {
      try {
        await this.s3Service.delete(file.key);
        this.logger.info(
          `Deleted file from S3 - id:${id} key:${file.key}`,
          ctx,
        );
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Failed to delete file from S3 - id:${id} error:${err.message}`,
          err.stack,
          ctx,
        );
        throw err;
      }
    }

    return deleted;
  }

  async fileExists(id: string): Promise<boolean> {
    const ctx = "FileService";
    this.logger.debug(`Checking if file exists - id:${id}`, ctx);
    const file = await this.fileRepository.findUnique({ where: { id } });
    return file !== null;
  }

  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    byContentType: Record<string, { count: number; total_size: number }>;
  }> {
    const ctx = "FileService";
    this.logger.debug("Getting file stats", ctx);

    const [totalFiles, byContentType] = await Promise.all([
      this.fileRepository.count(),
      this.fileRepository.getContentTypeAggregations(),
    ]);

    const totalSize = Object.values(byContentType).reduce(
      (sum, stat) => sum + stat.total_size,
      0,
    );

    this.logger.info(
      `Got stats - totalFiles:${totalFiles} totalSize:${totalSize}`,
      ctx,
    );

    return {
      totalFiles,
      totalSize,
      byContentType,
    };
  }
}
