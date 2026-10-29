import type { Aggregations, Collection } from "@repo/contracts";
import {
  and,
  asc,
  count,
  desc,
  ilike,
  inArray,
  or,
  type SQL,
} from "drizzle-orm";
import type {
  AnyPgColumn,
  PgSelect,
  PgTable,
  SelectedFields,
} from "drizzle-orm/pg-core";

import {
  collectionOf,
  parseCollectionQuery,
  type QueryRecord,
} from "../http/collection";
import type { Database } from "./database.module";

/**
 * A column a request may filter by, and the values it may name. The values are
 * also what the surface counts, so a filter nobody has selected still shows how
 * many rows each of its options would give.
 */
export interface Facet {
  /** Text, because its values are what the surface counts and shows. */
  column: AnyPgColumn<{ data: string; driverParam: string; notNull: true }>;
  values: readonly string[];
}

export interface CollectionSpec {
  /** The columns to return. */
  select: SelectedFields;
  /** Columns `?q=` matches against, case-insensitively. Any match wins. */
  search?: AnyPgColumn[];
  /** Sortable field names, each keyed to the column it means. */
  sort: Record<string, AnyPgColumn>;
  filters?: Record<string, Facet>;
  /** Applied after a request's own sort, so the request always wins. */
  defaultSort?: string;
}

/**
 * A faceted, paged read of one table.
 *
 * `parseCollectionQuery` turns the query string into a `CollectionQuery` and
 * stops there, which left every listing route to turn that into SQL itself: a
 * `where` from the search and the filters, an `orderBy` from a hand-written
 * field-to-column ladder, a count, and one bucket query per filter. The
 * notification log and the suppression list carried ninety near-identical lines
 * of that each, so the rule below was written twice and tested neither time.
 *
 * Declaring the table once moves all of it behind `page()`, and a new listing
 * route costs a declaration. The response is ADR-0002's contract, unchanged:
 * `collectionOf` still shapes it.
 *
 * **The rule worth knowing.** A facet's own selection is left out of its own
 * counts and applied to every other facet's. Choosing `status=failed` must not
 * reduce the status buckets to `{ failed: n }` — the counts exist to say what
 * the options you have *not* chosen would give — while the channel counts beside
 * them do narrow to the failed rows. The search narrows everything.
 *
 * The row type is the caller's to name. Drizzle's builder generics cannot
 * follow a table that arrives as a parameter rather than as a literal, so the
 * chain is assembled through `$dynamic()` and cast once, here, instead of
 * spreading `PgSelect` gymnastics across every route.
 */
export function collectionOver<TRow>(table: PgTable, spec: CollectionSpec) {
  const filters = spec.filters ?? {};
  const names = Object.keys(filters);

  return {
    async page(
      database: Database,
      rawQuery: QueryRecord,
      context: { path: string; prefix?: string },
    ): Promise<Collection<TRow>> {
      const query = parseCollectionQuery(rawQuery, {
        defaultSort: spec.defaultSort,
        filters: names,
        filterValues: Object.fromEntries(
          names.map((name) => [name, filters[name]!.values]),
        ),
        prefix: context.prefix,
        sortable: Object.keys(spec.sort),
      });

      const search =
        query.search && spec.search?.length
          ? or(
              ...spec.search.map((column) =>
                ilike(column, `%${query.search}%`),
              ),
            )
          : undefined;

      /** One facet's selection as SQL, or nothing when it selected nothing. */
      const chosenIn = (name: string): SQL | undefined => {
        const chosen = query.filters[name] ?? [];
        return chosen.length
          ? inArray(filters[name]!.column, chosen)
          : undefined;
      };

      /** The search, plus the selection of each of the named facets. */
      const narrowedBy = (facets: string[]): SQL | undefined =>
        and(search, ...facets.map(chosenIn));

      const where = narrowedBy(names);
      const order = query.sort.map(({ direction, field }) =>
        direction === "desc" ? desc(spec.sort[field]!) : asc(spec.sort[field]!),
      );

      const rows = database
        .select(spec.select)
        .from(table)
        .$dynamic() as unknown as PgSelect;

      const [data, [total], ...buckets] = await Promise.all([
        rows
          .where(where)
          .orderBy(...order)
          .limit(query.limit)
          .offset(query.offset),
        database.select({ value: count() }).from(table).where(where),
        // Each facet counts itself against everyone else's selection but not its
        // own, so every one of these carries a different `where`.
        ...names.map((name) =>
          database
            .select({ count: count(), value: filters[name]!.column })
            .from(table)
            .where(narrowedBy(names.filter((other) => other !== name)))
            .groupBy(filters[name]!.column),
        ),
      ]);

      const aggregations: Aggregations = Object.fromEntries(
        names.map((name, index) => [name, buckets[index] ?? []]),
      );

      return collectionOf(data as TRow[], total?.value ?? 0, query, {
        ...(names.length ? { aggregations } : {}),
        path: context.path,
        prefix: context.prefix,
        rawQuery,
      });
    },
  };
}
