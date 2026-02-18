export type PaginationParams = {
  page: number;
  limit: number;
};

export type AggregationBucket = {
  id: string;
  key: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
};

export type Aggregations = Record<string, AggregationBucket[]>;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  aggregations?: Aggregations;
};

export type PaginationInfo = {
  page: number;
  limit: number;
  offset: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

export function buildPaginationInfo(
  page: number,
  limit: number,
  total: number,
): PaginationInfo {
  const offset = (page - 1) * limit;
  const total_pages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    offset,
    total,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1,
  };
}

export function buildJsonApiResponse<T>(
  data: T,
  pagination?: PaginationInfo,
  aggregations: Aggregations = {},
) {
  return {
    data,
    meta: {
      ...(pagination ? { pagination } : {}),
      aggregations,
    },
  };
}

export function parsePaginationParams(query: {
  page?: string;
  limit?: string;
}): PaginationParams {
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(query.limit ?? "10", 10) || 10),
  );
  return { page, limit };
}
