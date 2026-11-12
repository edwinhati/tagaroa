import {
  DATA_TABLE_DEFAULT_PAGE_SIZE,
  DATA_TABLE_PAGE_SIZES,
} from "@repo/ui/blocks/data-table";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  functionalUpdate,
  type PaginationState,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * What a server-paged table keeps in its URL, so a filtered page is a link
 * someone can send. A default is never written: a link to the page carries no
 * query at all, and `?status=failed` says one thing rather than four.
 */
export interface CollectionSearch {
  page?: number;
  q?: string;
  size?: number;
  sort?: string;
}

// The router parses `?q=2024` as a number.
const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";

/**
 * The URL's collection state, keeping only what the core service accepts: it
 * refuses an unknown sort field rather than ignoring it.
 *
 * Every key is answered, `undefined` when the URL's value is unusable: the
 * router lays the validated search over the raw one, so a key left out keeps
 * whatever the URL said.
 */
export function parseCollectionSearch(
  search: Record<string, unknown>,
  sortable: readonly string[],
): CollectionSearch {
  const q = text(search.q).slice(0, 200);
  const sort = text(search.sort);
  const page = Number(search.page);
  const size = Number(search.size);
  return {
    page: Number.isInteger(page) && page > 1 ? page : undefined,
    q: q || undefined,
    size:
      size !== DATA_TABLE_DEFAULT_PAGE_SIZE &&
      DATA_TABLE_PAGE_SIZES.includes(size)
        ? size
        : undefined,
    sort:
      sort &&
      sort
        .split(",")
        .every((entry) => sortable.includes(entry.replace(/^-/, "")))
        ? sort
        : undefined,
  };
}

/** A facet's chosen values the core service knows; none is no filter. */
export function facetValues(
  value: unknown,
  known: readonly string[],
): string[] | undefined {
  const values = (Array.isArray(value) ? value : [value])
    .map(text)
    .filter((entry) => known.includes(entry));
  return values.length ? values : undefined;
}

/** The facets a collection filters by, each with the values it knows. */
export type Facets = Record<string, readonly string[]>;

/** Every facet's chosen values, from the URL. */
export const facetSearch = <F extends Facets>(
  search: Record<string, unknown>,
  facets: F,
) =>
  Object.fromEntries(
    Object.entries(facets).map(([name, known]) => [
      name,
      facetValues(search[name], known),
    ]),
  ) as { [K in keyof F]?: string[] };

/** A facet's options: every value the service knows, with its matching rows. */
export function facetOptions(
  buckets: readonly { count: number; value: string }[] | undefined,
  values: readonly string[],
  label: (value: string) => string,
) {
  const counts = new Map(
    (buckets ?? []).map((bucket) => [bucket.value, bucket.count]),
  );
  return values.map((value) => ({
    count: counts.get(value) ?? 0,
    label: label(value),
    value,
  }));
}

/** A collection request for the URL's state and the facets it filters by. */
export function collectionRequest<S extends CollectionSearch>(
  path: string,
  search: S,
  facets: { [K in keyof S]?: readonly string[] },
) {
  const query = new URLSearchParams({
    limit: String(search.size ?? DATA_TABLE_DEFAULT_PAGE_SIZE),
    page: String(search.page ?? 1),
  });
  if (search.sort) query.set("sort", search.sort);
  if (search.q) query.set("q", search.q);
  for (const facet of Object.keys(facets)) {
    for (const value of (search[facet as keyof S] as string[] | undefined) ??
      []) {
      query.append(facet, value);
    }
  }
  return `${path}?${query.toString()}`;
}

/**
 * A server-paged table's controls, read from and written to the URL, which is
 * their only state. Anything that changes what matches returns to page one:
 * staying on page 7 of a result that now has two shows an empty table and no
 * reason for it.
 *
 * The search box is the one control ahead of the URL. Its write waits for the
 * typing to pause, and is dropped once the page is being left: the box would
 * otherwise send someone back to the page they just left.
 */
export function useCollectionSearch<S extends CollectionSearch>({
  defaultSort,
  search,
  to,
}: {
  defaultSort: string;
  search: S;
  to: string;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const q = search.q ?? "";
  const page = search.page ?? 1;
  const size = search.size ?? DATA_TABLE_DEFAULT_PAGE_SIZE;
  const sort = search.sort ?? defaultSort;

  const [searchText, setText] = useState(q);
  // The query this box last put in the URL. Arriving there is not news; any
  // other query (Back, or a link) is, and the box follows it.
  const written = useRef(q);
  const pendingWrite = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (q !== written.current) {
      window.clearTimeout(pendingWrite.current);
      setText(q);
    }
    written.current = q;
  }, [q]);
  useEffect(() => () => window.clearTimeout(pendingWrite.current), []);

  const write = (change: Partial<S>) => {
    void navigate({
      replace: true,
      search: (current: S) => ({
        ...current,
        ...("page" in change ? {} : { page: undefined }),
        ...change,
      }),
      to,
    } as never);
  };

  const update = (change: Partial<S>) => {
    if ("q" in change) {
      window.clearTimeout(pendingWrite.current);
      written.current = change.q ?? "";
      setText(written.current);
    }
    write(change);
  };

  const setSearchText = (value: string) => {
    setText(value);
    window.clearTimeout(pendingWrite.current);
    pendingWrite.current = window.setTimeout(() => {
      const { pathname, search: current } = router.state.location;
      if (pathname.replace(/\/$/, "") !== to.replace(/\/$/, "")) return;
      const query = value.trim();
      if (query === ((current as CollectionSearch).q ?? "")) return;
      written.current = query;
      write({ q: query || undefined } as Partial<S>);
    }, 300);
  };

  const pagination: PaginationState = { pageIndex: page - 1, pageSize: size };
  const sorting = useMemo<SortingState>(
    () =>
      sort
        .split(",")
        .filter(Boolean)
        .map((entry) => ({
          desc: entry.startsWith("-"),
          id: entry.replace(/^-/, ""),
        })),
    [sort],
  );

  return {
    page,
    q,
    searchText,
    setSearchText,
    size,
    sort,
    update,
    /** Spread into `useDataTable`. */
    table: {
      manualPagination: true,
      manualSorting: true,
      onPaginationChange: (updater: Updater<PaginationState>) => {
        const next = functionalUpdate(updater, pagination);
        write({
          page: next.pageIndex > 0 ? next.pageIndex + 1 : undefined,
          size:
            next.pageSize === DATA_TABLE_DEFAULT_PAGE_SIZE
              ? undefined
              : next.pageSize,
        } as Partial<S>);
      },
      onSortingChange: (updater: Updater<SortingState>) => {
        const next = functionalUpdate(updater, sorting)
          .map(({ desc, id }) => `${desc ? "-" : ""}${id}`)
          .join(",");
        write({
          sort: next && next !== defaultSort ? next : undefined,
        } as Partial<S>);
      },
      state: { pagination, sorting },
    },
  };
}
