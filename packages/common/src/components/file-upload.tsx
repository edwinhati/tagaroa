"use client";

import type { FileWithPreview } from "@repo/common/hooks/use-file-upload";
import { formatBytes, useFileUpload } from "@repo/common/hooks/use-file-upload";
import { Button } from "@repo/ui/components/button";
import {
  IconAlertCircle,
  IconFile,
  IconFileText,
  IconFileZip,
  IconHeadphones,
  IconMovie,
  IconPhoto,
  IconTable,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import type * as React from "react";
import { useMemo } from "react";
export type { FileWithPreview };

const getFileIcon = (file: {
  file: File | { type: string; name: string; url?: string };
}) => {
  const fileType = file.file.type;
  const fileName = file.file.name;

  const iconMap = {
    pdf: {
      icon: IconFileText,
      conditions: (type: string, name: string) =>
        type.includes("pdf") ||
        name.endsWith(".pdf") ||
        type.includes("word") ||
        name.endsWith(".doc") ||
        name.endsWith(".docx"),
    },
    archive: {
      icon: IconFileZip,
      conditions: (type: string, name: string) =>
        type.includes("zip") ||
        type.includes("archive") ||
        name.endsWith(".zip") ||
        name.endsWith(".rar"),
    },
    excel: {
      icon: IconTable,
      conditions: (type: string, name: string) =>
        type.includes("excel") ||
        name.endsWith(".xls") ||
        name.endsWith(".xlsx"),
    },
    video: {
      icon: IconMovie,
      conditions: (type: string) => type.includes("video/"),
    },
    audio: {
      icon: IconHeadphones,
      conditions: (type: string) => type.includes("audio/"),
    },
    image: {
      icon: IconPhoto,
      conditions: (type: string) => type.startsWith("image/"),
    },
  };

  for (const { icon: Icon, conditions } of Object.values(iconMap)) {
    if (conditions(fileType, fileName)) {
      return <Icon className="size-5 opacity-60" />;
    }
  }

  return <IconFile className="size-5 opacity-60" />;
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
      crossOrigin="use-credentials"
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
    return <IconPhoto className="size-5 opacity-60" />;
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
      <section
        aria-label="File upload drop area - drag and drop files here to upload"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-dragging={isDragging || undefined}
        data-files={files.length > 0 || undefined}
        className="relative flex min-h-52 flex-col items-center overflow-hidden rounded-xl border border-dashed border-input p-4 transition-colors not-data-[files]:justify-center data-[dragging=true]:bg-accent/50 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
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
                  <IconUpload
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
                  <IconTrash
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
                    <IconX className="size-3.5" />
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
          <Button
            type="button"
            variant="ghost"
            className="flex flex-1 w-full flex-col items-center justify-center px-4 py-3 text-center outline-none cursor-pointer focus-visible:bg-accent/50"
            onClick={openFileDialog}
            disabled={disabled}
          >
            <div
              className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
              aria-hidden="true"
            >
              <IconFile className="size-4 opacity-60" />
            </div>
            <p className="mb-1.5 text-sm font-medium">Drop your files here</p>
            <p className="text-xs text-muted-foreground">
              Max {maxFiles} files ∙ Up to {maxSizeMB}MB
            </p>
            <div className="mt-4 flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors">
              <IconUpload
                className="-ms-1 me-2 opacity-60"
                aria-hidden="true"
              />
              Select files
            </div>
          </Button>
        )}
      </section>

      {errors.length > 0 && (
        <div
          className="flex items-center gap-1 text-xs text-destructive"
          role="alert"
        >
          <IconAlertCircle className="size-3 shrink-0" />
          <span>{errors[0]}</span>
        </div>
      )}
    </div>
  );
}
