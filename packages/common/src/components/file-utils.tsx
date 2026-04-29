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

export function getFileIcon(contentType = "", fileName = "") {
  if (contentType.startsWith("image/")) return IconPhoto;
  if (contentType.includes("pdf") || fileName.endsWith(".pdf"))
    return IconFileText;
  if (contentType.includes("video/")) return IconMovie;
  if (contentType.includes("audio/")) return IconHeadphones;
  if (contentType.includes("zip") || fileName.endsWith(".zip"))
    return IconFileZip;
  if (
    contentType.includes("excel") ||
    fileName.endsWith(".xls") ||
    fileName.endsWith(".xlsx")
  )
    return IconTable;
  return IconFile;
}
