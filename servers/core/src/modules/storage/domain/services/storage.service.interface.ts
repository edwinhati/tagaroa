export const STORAGE_SERVICE = Symbol("STORAGE_SERVICE");

export interface IStorageService {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  getPresignedUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
  getBucket(): string;
}
