export interface FileResponseDto {
  id: string;
  url: string;
  key: string;
  size: number;
  content_type: string;
  original_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
