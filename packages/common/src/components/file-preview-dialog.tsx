"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { IconDownload } from "@tabler/icons-react";
import { getDownloadUrl, getFileIcon } from "./file-utils";

interface FilePreviewDialogProps {
  fileId: string | null;
  fileName?: string;
  contentType?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isImage(contentType?: string) {
  return contentType?.startsWith("image/") ?? false;
}

function isPdf(contentType?: string, fileName?: string) {
  return contentType?.includes("pdf") || fileName?.endsWith(".pdf") || false;
}

export function FilePreviewDialog({
  fileId,
  fileName,
  contentType,
  open,
  onOpenChange,
}: FilePreviewDialogProps) {
  const downloadUrl = fileId ? getDownloadUrl(fileId) : "";
  const showImage = isImage(contentType);
  const showPdf = isPdf(contentType, fileName);
  const FileIcon = getFileIcon(contentType, fileName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-sm font-medium truncate flex items-center gap-2">
            <FileIcon size={16} className="text-muted-foreground shrink-0" />
            {fileName || "File Preview"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center min-h-[300px] max-h-[70vh] bg-muted/30">
          {showImage && downloadUrl && (
            /* biome-ignore lint/performance/noImgElement: Intended to be simple img */
            <img
              src={downloadUrl}
              alt={fileName || "Preview"}
              className="max-w-full max-h-[70vh] object-contain"
            />
          )}

          {showPdf && downloadUrl && (
            <iframe
              src={downloadUrl}
              title={fileName || "PDF Preview"}
              className="w-full h-[70vh] border-0"
            />
          )}

          {!showImage && !showPdf && (
            <div className="flex flex-col items-center gap-4 p-8">
              <FileIcon size={48} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Preview not available for this file type
              </p>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={fileName}
                  className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-xs hover:bg-muted hover:text-foreground transition-colors"
                >
                  <IconDownload size={14} className="mr-2" />
                  Download
                </a>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
