export type PaginationInfo = {
	page: number;
	limit: number;
	offset: number;
	total: number;
	total_pages: number;
	has_next: boolean;
	has_prev: boolean;
};

export type AggregationItem = {
	key: string;
	count: number;
	min: number;
	max: number;
	avg: number;
	sum: number;
};
