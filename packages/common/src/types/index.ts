import type { DateRange } from "react-day-picker";

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
  id: string;
  key: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
};

// JSON:API compliant types
export type JsonApiMeta = {
  pagination?: PaginationInfo;
  aggregations?: Record<string, AggregationItem[]>;
  timestamp?: string;
  message?: string;
  requestId?: string;
  traceId?: string;
};

export type JsonApiLinks = {
  self?: string;
  first?: string;
  last?: string;
  next?: string;
  prev?: string;
};

export type JsonApiResponse<T> = {
  data: T;
  meta?: JsonApiMeta;
  jsonapi?: { version: string };
  links?: JsonApiLinks;
};
// Legacy - marked as deprecated
export type FilterState = {
  serverFilters: Record<string, string[]>;
  range: DateRange | undefined;
  openPopovers: Record<string, boolean>;
  setServerFilters: (filters: Record<string, string[]>) => void;
  setRange: (range: DateRange | undefined) => void;
  setOpenPopovers: (popovers: Record<string, boolean>) => void;
};
