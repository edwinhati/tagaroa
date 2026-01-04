export interface File {
	id: string;
	url: string;
	key: string;
	size: number;
	content_type: string;
	original_name: string;
	deleted_at?: Date | null;
	created_at: Date;
	updated_at: Date;
}

export interface CreateFileInput {
	id?: string;
	url: string;
	key: string;
	size: number;
	content_type: string;
	original_name: string;
}

export interface UpdateFileInput {
	url?: string;
	key?: string;
	size?: number;
	content_type?: string;
	original_name?: string;
	deleted_at?: Date | null;
}
