import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../../../shared/database/database.constants";
import { File } from "../../../../domain/entities/file.entity";
import { FileNotFoundException } from "../../../../domain/exceptions/storage.exceptions";
import type { IFileRepository } from "../../../../domain/repositories/file.repository.interface";
import { FileMapper } from "../mappers/file.mapper";
import { files } from "../schemas/file.schema";

@Injectable()
export class DrizzleFileRepository implements IFileRepository {
  constructor(@Inject(DRIZZLE) private readonly db: BunSQLDatabase) {}

  async findById(id: string): Promise<File | null> {
    const [row] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, id), isNull(files.deletedAt)))
      .limit(1);

    return row ? FileMapper.toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<File[]> {
    const rows = await this.db
      .select()
      .from(files)
      .where(and(eq(files.userId, userId), isNull(files.deletedAt)))
      .orderBy(files.createdAt);

    return rows.map(FileMapper.toDomain);
  }

  async create(file: File): Promise<File> {
    const [row] = await this.db
      .insert(files)
      .values(FileMapper.toPersistence(file))
      .returning();

    if (!row) {
      throw new Error("Failed to create file record");
    }

    return FileMapper.toDomain(row);
  }

  async update(file: File): Promise<File> {
    const [row] = await this.db
      .update(files)
      .set({
        ...FileMapper.toPersistence(file),
        version: file.version + 1,
      })
      .where(and(eq(files.id, file.id), eq(files.version, file.version)))
      .returning();

    if (!row) {
      throw new FileNotFoundException(file.id);
    }

    return FileMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(files)
      .set({ deletedAt: new Date() })
      .where(eq(files.id, id));
  }
}
