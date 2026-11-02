import { describe, expect, test } from "bun:test";

import {
  collectionOf,
  pageCollection,
  parseCollectionQuery,
} from "./collection";

describe("collection HTTP contract", () => {
  test("parses bounded, namespaced queries and allowlisted multi-sort", () => {
    expect(
      parseCollectionQuery(
        {
          teamsLimit: "999",
          teamsPage: "2",
          teamsSort: "-name,id",
          teamsStatus: ["active", "pending"],
        },
        {
          filters: ["status"],
          prefix: "teams",
          sortable: ["id", "name"],
        },
      ),
    ).toEqual({
      filters: { status: ["active", "pending"] },
      limit: 100,
      offset: 100,
      page: 2,
      search: "",
      sort: [
        { direction: "desc", field: "name" },
        { direction: "asc", field: "id" },
      ],
    });
  });

  test("falls back from invalid pages and clamps oversized limits", () => {
    expect(
      parseCollectionQuery({ limit: "1000", page: "not-a-page" }),
    ).toMatchObject({ limit: 100, offset: 0, page: 1 });
    expect(parseCollectionQuery({ limit: "0", page: "-2" })).toMatchObject({
      limit: 25,
      offset: 0,
      page: 1,
    });
  });

  test("paginates empty and populated collections with relative links", () => {
    const query = parseCollectionQuery({
      page: "2",
      limit: "2",
      status: "open",
    });
    const result = pageCollection(["a", "b", "c"], query, {
      path: "/api/items",
      rawQuery: { page: "2", limit: "2", status: "open" },
    });

    expect(result.data).toEqual(["c"]);
    expect(result.meta).toMatchObject({ page: 2, total: 3, totalPages: 2 });
    expect(result.links.previous).toContain("status=open");

    const empty = pageCollection([], parseCollectionQuery({}), {
      path: "/api/items",
      rawQuery: {},
    });
    expect(empty.meta).toMatchObject({ page: 1, totalPages: 1 });

    const beyondLastPage = pageCollection(
      ["a"],
      parseCollectionQuery({ page: "3", limit: "1" }),
      { path: "/api/items", rawQuery: { page: "3", limit: "1" } },
    );
    expect(beyondLastPage.data).toEqual([]);
    expect(beyondLastPage.meta).toMatchObject({
      offset: 2,
      page: 3,
      totalPages: 1,
    });
    expect(beyondLastPage.links.self).toContain("page=3");
    expect(beyondLastPage.links.last).toContain("page=1");
  });

  test("rejects sort fields and filter values outside the endpoint allowlist", () => {
    expect(() =>
      parseCollectionQuery({ sort: "passwordHash" }, { sortable: ["name"] }),
    ).toThrow("Cannot sort by passwordHash.");

    expect(() =>
      parseCollectionQuery(
        { status: "invented" },
        {
          filters: ["status"],
          filterValues: { status: ["active", "banned"] },
        },
      ),
    ).toThrow("invented is not a valid status filter.");
  });
});

describe("collection paging limits and ordering", () => {
  test("defaults to page 1 of 25 and reads the first of repeated values", () => {
    expect(parseCollectionQuery({})).toMatchObject({
      limit: 25,
      offset: 0,
      page: 1,
    });
    expect(
      parseCollectionQuery({ limit: ["10", "50"], page: ["3", "1"] }),
    ).toMatchObject({ limit: 10, offset: 20, page: 3 });
    expect(parseCollectionQuery({ limit: "100" }).limit).toBe(100);
    expect(parseCollectionQuery({ limit: "2.5", page: "1.5" })).toMatchObject({
      limit: 25,
      page: 1,
    });
  });

  test("applies the request's sort first, then the default, each field once", () => {
    const sortable = ["createdAt", "id", "name"];
    expect(
      parseCollectionQuery(
        { sort: [" -name , createdAt", "-createdAt"] },
        { defaultSort: "id", sortable },
      ).sort,
    ).toEqual([
      { direction: "desc", field: "name" },
      { direction: "asc", field: "createdAt" },
      { direction: "asc", field: "id" },
    ]);
    expect(
      parseCollectionQuery({ sort: "name" }, { defaultSort: "-name", sortable })
        .sort,
    ).toEqual([{ direction: "asc", field: "name" }]);
    expect(
      parseCollectionQuery({}, { defaultSort: "-createdAt", sortable }).sort,
    ).toEqual([{ direction: "desc", field: "createdAt" }]);
    // A default outside the allow-list is an endpoint bug, not a request one.
    expect(
      parseCollectionQuery({}, { defaultSort: "secret", sortable }).sort,
    ).toEqual([]);
    expect(() => parseCollectionQuery({ sort: "-name" })).toThrow(
      "Cannot sort by -name.",
    );
  });

  test("filters and search ignore empty values and other prefixes", () => {
    expect(
      parseCollectionQuery(
        { q: ["  ada ", "grace"], status: ["", "open"], teamsStatus: "closed" },
        { filters: ["status", "role"] },
      ),
    ).toMatchObject({
      filters: { role: [], status: ["open"] },
      search: "ada",
    });
  });

  test("links keep the query, carry the prefix and stop at the edges", () => {
    const rawQuery = { teamsLimit: "2", teamsPage: "2", tag: ["a", "b"] };
    const query = parseCollectionQuery(rawQuery, { prefix: "teams" });
    const result = pageCollection(["a", "b", "c", "d", "e"], query, {
      path: "/api/teams",
      prefix: "teams",
      rawQuery,
    });

    expect(result.data).toEqual(["c", "d"]);
    expect(result.links).toEqual({
      first: "/api/teams?teamsLimit=2&teamsPage=1&tag=a&tag=b",
      last: "/api/teams?teamsLimit=2&teamsPage=3&tag=a&tag=b",
      next: "/api/teams?teamsLimit=2&teamsPage=3&tag=a&tag=b",
      previous: "/api/teams?teamsLimit=2&teamsPage=1&tag=a&tag=b",
      self: "/api/teams?teamsLimit=2&teamsPage=2&tag=a&tag=b",
    });
    expect(result.meta).toEqual({
      hasNext: true,
      hasPrevious: true,
      limit: 2,
      offset: 2,
      page: 2,
      total: 5,
      totalPages: 3,
    });

    const only = pageCollection(["a"], parseCollectionQuery({}), {
      path: "/api/items",
      rawQuery: {},
    });
    expect(only.links).toEqual({
      first: "/api/items?page=1&limit=25",
      last: "/api/items?page=1&limit=25",
      self: "/api/items?page=1&limit=25",
    });
    expect(only.meta).toMatchObject({ hasNext: false, hasPrevious: false });
  });

  test("aggregations ride in meta only when given", () => {
    const query = parseCollectionQuery({});
    const context = { path: "/api/items", rawQuery: {} };
    expect(collectionOf([], 0, query, context).meta).not.toHaveProperty(
      "aggregations",
    );
    const aggregations = { status: [{ count: 2, value: "open" }] };
    expect(
      collectionOf([], 0, query, { ...context, aggregations }).meta
        .aggregations,
    ).toEqual(aggregations);
  });
});
