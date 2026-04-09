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
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { FileResponseDto } from "../../application/dtos/file-response.dto";
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
    private readonly configService: ConfigService,
  ) {}

  private getDownloadUrl(fileId: string): string {
    const baseUrl = this.configService.get<string>("BASE_URL", "");
    const port = this.configService.get<number>("PORT", 8081);

    // Check if BASE_URL already includes a port
    const hasPort = /:\d+$/.test(baseUrl);
    return hasPort
      ? `${baseUrl}/api/storage/${fileId}/download`
      : `${baseUrl}:${port}/api/storage/${fileId}/download`;
  }

  private toFileResponse(result: {
    id: string;
    key: string;
    size: number;
    contentType: string;
    originalName: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): FileResponseDto {
    return {
      id: result.id,
      url: this.getDownloadUrl(result.id),
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

    return this.toFileResponse(result);
  }

  @Get(":id")
  async getFile(
    @Session() session: UserSession,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const file = await this.getFileUseCase.execute(id, session.user.id);

    return this.toFileResponse(file);
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
    const match = /^(\d+)([smhd])$/.exec(expiry);
    if (!match?.[1] || !match[2]) return 3600; // Default 1 hour

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
