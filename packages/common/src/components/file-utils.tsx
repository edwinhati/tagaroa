import {
  IconFile,
  IconFileText,
  IconFileZip,
  IconHeadphones,
  IconMovie,
  IconPhoto,
  IconTable,
} from "@tabler/icons-react";

export function getDownloadUrl(fileId: string): string {
  return `/api/storage/${fileId}/download`;
}

export function getFileIcon(contentType?: string, fileName?: string) {
  const type = contentType || "";
  const name = fileName || "";

  if (type.startsWith("image/")) return IconPhoto;
  if (type.includes("pdf") || name.endsWith(".pdf")) return IconFileText;
  if (type.includes("video/")) return IconMovie;
  if (type.includes("audio/")) return IconHeadphones;
  if (type.includes("zip") || name.endsWith(".zip")) return IconFileZip;
  if (type.includes("excel") || name.endsWith(".xls") || name.endsWith(".xlsx"))
    return IconTable;
  return IconFile;
}
