import { describe, expect, test } from "bun:test";

import { pageCollection, parseCollectionQuery } from "./collection";

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
