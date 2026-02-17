const ALLOWED_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Archives
  "application/zip",
  "application/x-tar",
  "application/gzip",
  // Text
  "text/plain",
  "text/csv",
  "application/json",
]);

export const MimeType = {
  isAllowed(mimeType: string): boolean {
    return ALLOWED_TYPES.has(mimeType);
  },

  getAllowedTypes(): string[] {
    return Array.from(ALLOWED_TYPES);
  },
};
