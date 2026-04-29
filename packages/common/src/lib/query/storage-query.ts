"use client";

import { storageApi } from "@repo/common/lib/http";
import {
  mutationOptions,
  queryOptions,
  useQueryClient,
} from "@tanstack/react-query";

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
const getFile = async (id: string): Promise<FileMetadata> => {
  return storageApi.get<FileMetadata>(`/${id}`);
};

// Get presigned URL for file
// Delete file
export const useUploadFileMutationOptions = () => {
  const queryClient = useQueryClient();

  return mutationOptions<FileMetadata, Error, File>({
    mutationKey: ["uploadFile"],
    mutationFn: uploadFile,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
};

export const fileQueryOptions = (id: string) =>
  queryOptions<FileMetadata, Error>({
    queryKey: ["file", id],
    queryFn: () => getFile(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
