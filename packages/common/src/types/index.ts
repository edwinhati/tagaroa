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
  key: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
};

export type FilterState = {
  serverFilters: Record<string, string[]>;
  range: DateRange | undefined;
  openPopovers: Record<string, boolean>;
  setServerFilters: (filters: Record<string, string[]>) => void;
  setRange: (range: DateRange | undefined) => void;
  setOpenPopovers: (popovers: Record<string, boolean>) => void;
};
