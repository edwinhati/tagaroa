import { File } from "../entities/file.entity";

export const FILE_REPOSITORY = "FILE_REPOSITORY";

export interface IFileRepository {
  findById(id: string): Promise<File | null>;
  findByUserId(userId: string): Promise<File[]>;
  create(file: File): Promise<File>;
  update(file: File): Promise<File>;
  delete(id: string): Promise<void>;
}
