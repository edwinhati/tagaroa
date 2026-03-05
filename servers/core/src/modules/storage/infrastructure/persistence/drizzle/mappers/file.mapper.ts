import { File } from "../../../../domain/entities/file.entity";
import type { FileStatus } from "../../../../domain/value-objects/file-status";
import type { files } from "../schemas/file.schema";

type FileRow = typeof files.$inferSelect;
type FileInsert = typeof files.$inferInsert;

export const FileMapper = {
  toDomain(row: FileRow): File {
    return new File(
      row.id,
      row.key,
      row.bucket,
      row.url || null,
      row.size,
      row.contentType,
      row.originalName,
      row.userId,
      row.status as FileStatus,
      row.scanResult || null,
      row.deletedAt || null,
      row.createdAt,
      row.updatedAt,
      row.version,
    );
  },

  toPersistence(file: File): FileInsert {
    return {
      id: file.id,
      key: file.key,
      bucket: file.bucket,
      url: file.url,
      size: file.size,
      contentType: file.contentType,
      originalName: file.originalName,
      userId: file.userId,
      status: file.status,
      scanResult: file.scanResult,
      deletedAt: file.deletedAt,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      version: file.version,
    };
  },
};
