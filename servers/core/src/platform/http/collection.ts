import { BadRequestException } from "@nestjs/common";
import { PAGE_SIZE } from "@repo/contracts";
import type {
  Aggregations,
  Collection,
  PaginationLinks,
} from "@repo/contracts";

type QueryValue = string | string[] | undefined;
export type QueryRecord = Record<string, QueryValue>;

export interface CollectionQuery {
  page: number;
  limit: number;
  offset: number;
  search: string;
  sort: { field: string; direction: "asc" | "desc" }[];
  filters: Record<string, string[]>;
}

const keyFor = (prefix: string, name: string) =>
  prefix ? `${prefix}${name[0]!.toUpperCase()}${name.slice(1)}` : name;

const values = (value: QueryValue): string[] =>
  (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);

const positiveInteger = (value: QueryValue, fallback: number): number => {
  const parsed = Number(values(value)[0]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export function parseCollectionQuery(
  query: QueryRecord,
  options: {
    prefix?: string;
    filters?: readonly string[];
    filterValues?: Record<string, readonly string[]>;
    sortable?: readonly string[];
    defaultSort?: string;
  } = {},
): CollectionQuery {
  const prefix = options.prefix ?? "";
  const page = positiveInteger(query[keyFor(prefix, "page")], 1);
  const limit = Math.min(
    positiveInteger(query[keyFor(prefix, "limit")], PAGE_SIZE.default),
    PAGE_SIZE.max,
  );
  const allowedSort = new Set(options.sortable ?? []);
  const requestedSort = values(query[keyFor(prefix, "sort")])
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
  const invalidSort = requestedSort.find(
    (entry) => !allowedSort.has(entry.replace(/^-/, "")),
  );
  if (invalidSort) {
    throw new BadRequestException(`Cannot sort by ${invalidSort}.`);
  }
  const sort = [
    ...requestedSort,
    ...(options.defaultSort ? [options.defaultSort] : []),
  ]
    .map((entry) => ({
      direction: entry.startsWith("-") ? ("desc" as const) : ("asc" as const),
      field: entry.replace(/^-/, ""),
    }))
    .filter(
      (entry, index, entries) =>
        allowedSort.has(entry.field) &&
        entries.findIndex((candidate) => candidate.field === entry.field) ===
          index,
    );

  const filters = Object.fromEntries(
    (options.filters ?? []).map((filter) => {
      const selected = values(query[keyFor(prefix, filter)]);
      const allowed = options.filterValues?.[filter];
      const invalid = allowed
        ? selected.find((value) => !allowed.includes(value))
        : undefined;
      if (invalid) {
        throw new BadRequestException(
          `${invalid} is not a valid ${filter} filter.`,
        );
      }
      return [filter, selected];
    }),
  );

  return {
    filters,
    limit,
    offset: (page - 1) * limit,
    page,
    search: values(query[keyFor(prefix, "q")])[0]?.trim() ?? "",
    sort,
  };
}

const withPage = (
  path: string,
  query: QueryRecord,
  prefix: string,
  page: number,
  limit: number,
): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const entry of values(value)) params.append(key, entry);
  }
  params.set(keyFor(prefix, "page"), String(page));
  params.set(keyFor(prefix, "limit"), String(limit));
  return `${path}?${params.toString()}`;
};

export function collectionOf<T>(
  data: T[],
  total: number,
  query: Pick<CollectionQuery, "page" | "limit" | "offset">,
  context: {
    path: string;
    rawQuery: QueryRecord;
    prefix?: string;
    aggregations?: Aggregations;
  },
): Collection<T> {
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = query.page;
  const link = (target: number) =>
    withPage(
      context.path,
      context.rawQuery,
      context.prefix ?? "",
      target,
      query.limit,
    );
  const links: PaginationLinks = {
    first: link(1),
    last: link(totalPages),
    self: link(page),
  };
  if (page > 1) links.previous = link(page - 1);
  if (page < totalPages) links.next = link(page + 1);

  return {
    data,
    links,
    meta: {
      ...(context.aggregations ? { aggregations: context.aggregations } : {}),
      hasNext: page < totalPages,
      hasPrevious: page > 1,
      limit: query.limit,
      offset: (page - 1) * query.limit,
      page,
      total,
      totalPages,
    },
  };
}

export function pageCollection<T>(
  rows: T[],
  query: CollectionQuery,
  context: Parameters<typeof collectionOf<T>>[3],
): Collection<T> {
  return collectionOf(
    rows.slice(query.offset, query.offset + query.limit),
    rows.length,
    query,
    context,
  );
}
