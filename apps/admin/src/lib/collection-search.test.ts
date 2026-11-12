import { expect, test } from "bun:test";

import {
  collectionRequest,
  facetValues,
  parseCollectionSearch,
} from "./collection-search";
import {
  DELIVERY_FACETS,
  type DeliverySearch,
  validateDeliverySearch,
} from "./notifications";

test("keeps only the collection state the core service accepts", () => {
  expect(
    parseCollectionSearch(
      { page: "2", q: "  ada ", size: "50", sort: "-createdAt,key" },
      ["createdAt", "key"],
    ),
  ).toEqual({ page: 2, q: "ada", size: 50, sort: "-createdAt,key" });
  expect(
    parseCollectionSearch({ page: "1", size: "25", sort: "createdAt,email" }, [
      "createdAt",
    ]),
  ).toEqual({});
});

test("a facet keeps the values the service knows, and none is no filter", () => {
  expect(facetValues(["failed", " sent", "lost"], ["failed", "sent"])).toEqual([
    "failed",
    "sent",
  ]);
  expect(facetValues("lost", ["failed"])).toBeUndefined();
});

test("what the router hands the page carries nothing the service would refuse", () => {
  // The router lays the validated search over the raw query.
  const raw = { page: "0", ref: "abc", sort: "email", status: "lost", x: 1 };
  const search = { ...raw, ...validateDeliverySearch(raw) } as DeliverySearch;

  expect(
    collectionRequest("/api/notifications/messages", search, DELIVERY_FACETS),
  ).toBe("/api/notifications/messages?limit=25&page=1");
});
