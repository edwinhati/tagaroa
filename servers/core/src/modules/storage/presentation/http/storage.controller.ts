import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { DeleteFileUseCase } from "../../application/use-cases/delete-file.use-case";
import { DownloadFileUseCase } from "../../application/use-cases/download-file.use-case";
import { GetFileUseCase } from "../../application/use-cases/get-file.use-case";
import { GetPresignedUrlUseCase } from "../../application/use-cases/get-presigned-url.use-case";
import { UploadFileUseCase } from "../../application/use-cases/upload-file.use-case";

@Controller("storage")
export class StorageController {
  constructor(
    private readonly uploadFileUseCase: UploadFileUseCase,
    private readonly getFileUseCase: GetFileUseCase,
    private readonly downloadFileUseCase: DownloadFileUseCase,
    private readonly getPresignedUrlUseCase: GetPresignedUrlUseCase,
    private readonly deleteFileUseCase: DeleteFileUseCase,
  ) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @Session() session: UserSession,
    @UploadedFile() file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
  ) {
    const result = await this.uploadFileUseCase.execute(
      session.user.id,
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Construct the download URL
    const baseUrl = process.env.BASE_URL || "http://localhost";
    const port = process.env.PORT || 8081;

    // Check if BASE_URL already includes a port (e.g., http://localhost:8080)
    const hasPort = /:\d+$/.test(baseUrl);
    const downloadUrl = hasPort
      ? `${baseUrl}/api/storage/${result.id}/download`
      : `${baseUrl}:${port}/api/storage/${result.id}/download`;

    return {
      id: result.id,
      url: downloadUrl, // Use secure download endpoint with full URL
      key: result.key,
      size: result.size,
      content_type: result.contentType,
      original_name: result.originalName,
      status: result.status,
      created_at: result.createdAt.toISOString(),
      updated_at: result.updatedAt.toISOString(),
      deleted_at: result.deletedAt?.toISOString() || null,
    };
  }

  @Get(":id")
  async getFile(
    @Session() session: UserSession,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const file = await this.getFileUseCase.execute(id, session.user.id);

    // Construct the download URL
    const baseUrl = process.env.BASE_URL || "http://localhost";
    const port = process.env.PORT || 8081;

    // Check if BASE_URL already includes a port (e.g., http://localhost:8080)
    const hasPort = /:\d+$/.test(baseUrl);
    const downloadUrl = hasPort
      ? `${baseUrl}/api/storage/${file.id}/download`
      : `${baseUrl}:${port}/api/storage/${file.id}/download`;

    return {
      id: file.id,
      url: downloadUrl, // Use secure download endpoint with full URL
      key: file.key,
      size: file.size,
      content_type: file.contentType,
      original_name: file.originalName,
      status: file.status,
      created_at: file.createdAt.toISOString(),
      updated_at: file.updatedAt.toISOString(),
      deleted_at: file.deletedAt?.toISOString() || null,
    };
  }

  @Get(":id/download")
  @Header("Cache-Control", "private, max-age=3600")
  async downloadFile(
    @Session() session: UserSession,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const { buffer, contentType, fileName } =
      await this.downloadFileUseCase.execute(id, session.user.id);

    return new StreamableFile(buffer, {
      type: contentType,
      disposition: `inline; filename="${fileName}"`,
      length: buffer.length,
    });
  }

  @Get(":id/url")
  async getPresignedUrl(
    @Session() session: UserSession,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("expiry") expiry?: string,
  ) {
    const expiresIn = expiry ? this.parseExpiry(expiry) : 3600;
    return this.getPresignedUrlUseCase.execute(id, session.user.id, expiresIn);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @Session() session: UserSession,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.deleteFileUseCase.execute(id, session.user.id);
  }

  private parseExpiry(expiry: string): number {
    // Parse expiry string like "1h", "30m", "1d"
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match || !match[1] || !match[2]) return 3600; // Default 1 hour

    const value = Number.parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 3600;
      case "d":
        return value * 86400;
      default:
        return 3600;
    }
  }
}
