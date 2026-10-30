# 2. Collection contract and data tables

Date: 2026-08-30

## Status

Accepted

## Context

The admin surface had three unrelated table implementations. App-owned read
endpoints also returned a mix of bare arrays and objects containing bare arrays,
which encouraged callers to request an arbitrary large limit and silently lose
anything beyond it.

## Decision

App-owned object reads return `{ data }`. A root list returns a collection:

```ts
{
  data: T[];
  meta: { page; limit; offset; total; totalPages; hasNext; hasPrevious; aggregations? };
  links: { self; first; last; previous?; next? };
}
```

Lists nested in an object use that same collection shape. Their flat query keys
are namespaced (`teamsPage`, `teamsLimit`, `teamsQ`, `teamsSort`). Root lists use
`page`, `limit`, `q`, repeated filter keys, and comma-separated multi-sort where
`-createdAt` means descending. Pages are one-based, default to 25 rows, and are
capped at 100. Relative links are authoritative for traversing a collection.

This is a Tagaroa HTTP contract, not JSON:API. It keeps the existing camelCase
wire format and does not introduce resource `type`, `attributes`, or relationship
documents that the product does not use.

Better Auth routes, health probes, writes, and the Meta webhook challenge are
unchanged. Callers that need a complete non-table list must follow `links.next`;
they must not guess a sufficiently large limit.

Tables use the composable TanStack Table v9 block exported by `@repo/ui`. Screens
own their columns and domain cells. The block owns semantic table markup, search
and facet controls, sort headers, column visibility, pagination, mobile cards,
selection helpers, CSV export, destructive confirmation, loading, and empty
states. Capabilities are opt-in; current screens do not enable selection, export,
or bulk deletion.

## Consequences

- New list endpoints and nested lists must use the collection contract.
- Server-backed table search waits 300 ms before changing the URL and query.
- Search, filters, and multi-sort are shareable URL state. Pagination, page size,
  visibility, and selection are interaction state unless a screen needs otherwise.
- Facet counts apply search and other facets while excluding their own filter.
- Desktop renders a native table. Mobile renders labelled cards without dropping
  row information or turning pointer rows into redundant keyboard stops.
