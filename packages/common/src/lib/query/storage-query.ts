"use client";

import { storageApi } from "@repo/common/lib/http";
import { mutationOptions, useQueryClient } from "@tanstack/react-query";

export type FileMetadata = {
  id: string;
  url: string;
  key: string;
  size?: number;
  content_type?: string;
  original_name?: string;
  deleted_at: string;
  created_at: string;
  updated_at: string;
};

// Upload file using the storageApi with authentication
const uploadFile = async (file: File): Promise<FileMetadata> => {
  return storageApi.upload<FileMetadata>(file);
};

// Get file by ID
// Get presigned URL for file
// Delete file
export const uploadFileMutationOptions = () => {
  const queryClient = useQueryClient();

  return mutationOptions<FileMetadata, Error, File>({
    mutationKey: ["uploadFile"],
    mutationFn: uploadFile,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
};
