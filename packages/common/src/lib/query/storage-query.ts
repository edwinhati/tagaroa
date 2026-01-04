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
const getPresignedUrl = async (
  id: string,
  expiry = "1h",
): Promise<{ url: string; expiry: string }> => {
  return storageApi.get<{ url: string; expiry: string }>(
    `/${id}/url?expiry=${expiry}`,
  );
};

// Delete file
const deleteFile = async (id: string): Promise<void> => {
  return storageApi.delete<void>(`/${id}`);
};

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

export const getFileQueryOptions = (id: string) => {
  return queryOptions<FileMetadata, Error>({
    queryKey: ["file", id],
    queryFn: () => getFile(id),
    enabled: !!id,
  });
};

export const getPresignedUrlQueryOptions = (id: string) => {
  return queryOptions<{ url: string; expiry: string }, Error>({
    queryKey: ["presignedUrl", id],
    queryFn: () => getPresignedUrl(id),
    enabled: !!id,
  });
};

export const deleteFileMutationOptions = (id: string) => {
  const queryClient = useQueryClient();

  return mutationOptions<void, Error>({
    mutationFn: () => deleteFile(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
};
