"use client";

import { fileQueryOptions } from "@repo/common/lib/query/storage-query";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  IconFile,
  IconFileText,
  IconFileZip,
  IconHeadphones,
  IconMovie,
  IconPhoto,
  IconTable,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

function getDownloadUrl(fileId: string): string {
  return `/api/storage/${fileId}/download`;
}

export type FilePreviewData = {
  id: string;
  name?: string;
  contentType?: string;
};

interface FileListItemProps {
  fileId: string;
  onClick?: (data: FilePreviewData) => void;
}

function getFileIcon(contentType?: string, fileName?: string) {
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

function formatFileSize(bytes?: number) {
  if (bytes === undefined || bytes === null) return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export function FileListItem({ fileId, onClick }: FileListItemProps) {
  const { data: file, isLoading } = useQuery(fileQueryOptions(fileId));

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-1 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    );
  }

  const FileIcon = getFileIcon(file?.content_type, file?.original_name);
  const isImage = file?.content_type?.startsWith("image/");

  return (
    <button
      type="button"
      onClick={() =>
        onClick?.({
          id: fileId,
          name: file?.original_name,
          contentType: file?.content_type,
        })
      }
      className="flex items-center gap-3 w-full text-left py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        {isImage && file ? (
          // biome-ignore lint/performance/noImgElement: Intended to be simple img
          <img
            src={getDownloadUrl(fileId)}
            alt=""
            className="h-9 w-9 rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <FileIcon size={18} className="text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">
          {file?.original_name || fileId}
        </p>
        {file?.size !== undefined && (
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </p>
        )}
      </div>
    </button>
  );
}
