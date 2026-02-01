"use client";

import { formatBytes, useFileUpload } from "@repo/common/hooks/use-file-upload";
import { Button } from "@repo/ui/components/button";
import {
  AlertCircleIcon,
  FileArchiveIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  HeadphonesIcon,
  ImageIcon,
  Trash2Icon,
  UploadIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import type React from "react";
import { useMemo } from "react";

export type { FileWithPreview } from "@repo/common/hooks/use-file-upload";

const getFileIcon = (file: {
  file: File | { type: string; name: string; url?: string };
}) => {
  const fileType = file.file.type;
  const fileName = file.file.name;

  const iconMap = {
    pdf: {
      icon: FileTextIcon,
      conditions: (type: string, name: string) =>
        type.includes("pdf") ||
        name.endsWith(".pdf") ||
        type.includes("word") ||
        name.endsWith(".doc") ||
        name.endsWith(".docx"),
    },
    archive: {
      icon: FileArchiveIcon,
      conditions: (type: string, name: string) =>
        type.includes("zip") ||
        type.includes("archive") ||
        name.endsWith(".zip") ||
        name.endsWith(".rar"),
    },
    excel: {
      icon: FileSpreadsheetIcon,
      conditions: (type: string, name: string) =>
        type.includes("excel") ||
        name.endsWith(".xls") ||
        name.endsWith(".xlsx"),
    },
    video: {
      icon: VideoIcon,
      conditions: (type: string) => type.includes("video/"),
    },
    audio: {
      icon: HeadphonesIcon,
      conditions: (type: string) => type.includes("audio/"),
    },
    image: {
      icon: ImageIcon,
      conditions: (type: string) => type.startsWith("image/"),
    },
  };

  for (const { icon: Icon, conditions } of Object.values(iconMap)) {
    if (conditions(fileType, fileName)) {
      return <Icon className="size-5 opacity-60" />;
    }
  }

  return <FileIcon className="size-5 opacity-60" />;
};

const getFilePreview = (file: {
  file: File | { type: string; name: string; url?: string };
}) => {
  const fileType = file.file.type;
  const fileName = file.file.name;

  const renderImage = (src: string) => (
    // biome-ignore lint/performance/noImgElement: Using <img> for blob URLs which next/image doesn't support
    <img
      src={src}
      alt={fileName}
      className="absolute inset-0 w-full h-full rounded-t-[inherit] object-cover"
    />
  );

  const renderImageContent = () => {
    if (file.file instanceof File) {
      const previewUrl = URL.createObjectURL(file.file);
      return renderImage(previewUrl);
    }
    if (file.file.url) {
      return renderImage(file.file.url);
    }
    return <ImageIcon className="size-5 opacity-60" />;
  };

  return (
    <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-t-[inherit] bg-accent">
      {fileType.startsWith("image/") ? renderImageContent() : getFileIcon(file)}
    </div>
  );
};

interface FileUploadProps {
  maxSizeMB?: number;
  maxFiles?: number;
  value?: FileWithPreview[];
  onChange?: (files: FileWithPreview[]) => void;
  onFilesAdded?: (files: FileWithPreview[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
}

export function FileUpload({
  maxSizeMB = 5,
  maxFiles = 6,
  value = [],
  onChange,
  onFilesAdded,
  accept = "*",
  multiple = true,
  disabled = false,
}: Readonly<FileUploadProps>) {
  const maxSize = maxSizeMB * 1024 * 1024;

  const initialFiles = useMemo(() => {
    return value.map((f) => ({
      id: f.id,
      name: f.file.name,
      size: f.file.size,
      type: f.file.type,
      url: f.preview || "",
    }));
  }, [value]);

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      clearFiles,
      getInputProps,
    },
  ] = useFileUpload({
    multiple,
    maxFiles,
    maxSize,
    accept,
    initialFiles,
    onFilesChange: onChange,
    onFilesAdded,
  });

  return (
    <div className="flex flex-col gap-2">
      {/* Drop area */}
      <div
        role="button"
        tabIndex={0}
        aria-label="File upload area - click to select files or drag and drop"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={(e) => {
          // Only open file dialog if clicking on drop area itself, not on buttons
          if (e.target === e.currentTarget && files.length === 0) {
            openFileDialog();
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && files.length === 0) {
            e.preventDefault();
            openFileDialog();
          }
        }}
        data-dragging={isDragging || undefined}
        data-files={files.length > 0 || undefined}
        className="relative flex min-h-52 flex-col items-center overflow-hidden rounded-xl border border-dashed border-input p-4 transition-colors not-data-[files]:justify-center has-[input:focus]:border-ring has-[input:focus]:ring-[3px] focus:ring-ring/50 data-[dragging=true]:bg-accent/50 focus:outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
      >
        <input
          {...(() => {
            const { ref, ...inputProps } = getInputProps({
              className: "sr-only",
              "aria-label": "Upload files",
            });
            return inputProps;
          })()}
          ref={(() => {
            const { ref } = getInputProps();
            return ref as React.Ref<HTMLInputElement>;
          })()}
          disabled={disabled}
        />

        {files.length > 0 ? (
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-medium">
                Files ({files.length})
              </h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openFileDialog();
                  }}
                  disabled={disabled}
                >
                  <UploadIcon
                    className="-ms-0.5 size-3.5 opacity-60"
                    aria-hidden="true"
                  />
                  Add files
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFiles();
                  }}
                  disabled={disabled}
                >
                  <Trash2Icon
                    className="-ms-0.5 size-3.5 opacity-60"
                    aria-hidden="true"
                  />
                  Remove all
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="relative flex flex-col rounded-md border bg-background"
                >
                  {getFilePreview(file)}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.id);
                    }}
                    size="icon"
                    className="absolute -top-2 -right-2 size-6 rounded-full border-2 border-background shadow-none focus-visible:border-background"
                    aria-label="Remove file"
                    disabled={disabled}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                  <div className="flex min-w-0 flex-col gap-0.5 border-t p-3">
                    <p className="truncate text-[13px] font-medium">
                      {file.file.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatBytes(file.file.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
            <div
              className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
              aria-hidden="true"
            >
              <FileIcon className="size-4 opacity-60" />
            </div>
            <p className="mb-1.5 text-sm font-medium">Drop your files here</p>
            <p className="text-xs text-muted-foreground">
              Max {maxFiles} files ∙ Up to {maxSizeMB}MB
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={(e) => {
                e.stopPropagation();
                openFileDialog();
              }}
              disabled={disabled}
            >
              <UploadIcon className="-ms-1 opacity-60" aria-hidden="true" />
              Select files
            </Button>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div
          className="flex items-center gap-1 text-xs text-destructive"
          role="alert"
        >
          <AlertCircleIcon className="size-3 shrink-0" />
          <span>{errors[0]}</span>
        </div>
      )}
    </div>
  );
}
