import { describe, expect, test } from "bun:test";

import { asObject, messageFor, WORKING_DOMAINS } from "./index";
import type {
  AggregationBucket,
  Aggregations,
  ApiDocument,
  Collection,
  ObjectLike,
  PaginationLinks,
  PaginationMeta,
  WorkingDomainSlug,
} from "./index";

test("collection documents keep list and object responses distinct", () => {
  const object: ApiDocument<{ name: string }> = { data: { name: "Tagaroa" } };
  const collection: Collection<string> = {
    data: ["email"],
    links: { first: "?page=1", last: "?page=1", self: "?page=1" },
    meta: {
      hasNext: false,
      hasPrevious: false,
      limit: 25,
      offset: 0,
      page: 1,
      total: 1,
      totalPages: 1,
    },
  };

  expect(object.data.name).toBe("Tagaroa");
  expect(collection.meta.total).toBe(collection.data.length);
});

describe("asObject", () => {
  test.each(
    [{}, [], new Date(0), Object.create(null)].map((value) => ({ value })),
  )("preserves object identity for %p", ({ value }) => {
    expect(asObject(value)).toBe(value);
  });

  test.each([true, false, NaN, Infinity, 1n, Symbol("id"), () => ({})])(
    "rejects non-object input %p",
    (value) => {
      expect(asObject(value)).toBeUndefined();
    },
  );

  test("does not validate or strip object fields", () => {
    const value: ObjectLike = { extra: true, id: 42, message: null };
    expect(asObject(value)).toBe(value);
    expect(asObject(value)).toEqual({ extra: true, id: 42, message: null });
  });

  test("passes objects and arrays through", () => {
    const value = { id: "user" };
    expect(asObject(value)).toBe(value);
    expect(asObject([1, 2])).toEqual([1, 2] as unknown as Record<
      string,
      unknown
    >);
  });

  test("rejects null and every primitive", () => {
    expect(asObject(null)).toBeUndefined();
    expect(asObject(undefined)).toBeUndefined();
    expect(asObject("user")).toBeUndefined();
    expect(asObject(0)).toBeUndefined();
  });
});

describe("messageFor", () => {
  test.each(
    [
      undefined,
      "Thrown string",
      42,
      false,
      1n,
      Symbol("error"),
      [],
      {},
      { message: null },
      { message: undefined },
      { message: [] },
      { message: {} },
      new Error(),
    ].map((value) => ({ value })),
  )("uses the caller's fallback for %p", ({ value }) => {
    expect(messageFor(value, "Please retry.")).toBe("Please retry.");
    expect(messageFor(value, "")).toBe("");
  });

  test.each([" ", "\n", "  Keep spacing.  ", "<script>literal</script>"])(
    "preserves a nonempty message verbatim: %p",
    (message) => {
      expect(messageFor({ message }, "Fallback")).toBe(message);
    },
  );

  test("reads inherited messages and Error subclasses", () => {
    expect(
      messageFor(Object.create({ message: "Inherited" }), "Fallback"),
    ).toBe("Inherited");
    expect(messageFor(new TypeError("Bad type"), "Fallback")).toBe("Bad type");
  });

  test("uses a supplied error message", () => {
    expect(messageFor({ message: "Try again." }, "Sign-in failed.")).toBe(
      "Try again.",
    );
    expect(messageFor(new Error("Offline."), "Sign-in failed.")).toBe(
      "Offline.",
    );
  });

  test("falls back when no useful message exists", () => {
    expect(messageFor({ message: "" }, "Sign-in failed.")).toBe(
      "Sign-in failed.",
    );
    expect(messageFor({ message: 12 }, "Sign-in failed.")).toBe(
      "Sign-in failed.",
    );
    expect(messageFor(null, "Sign-in failed.")).toBe("Sign-in failed.");
  });
});

test("collection contracts support navigation and aggregations", () => {
  const bucket: AggregationBucket = { count: 2, value: "engineering" };
  const aggregations: Aggregations = { domain: [bucket], empty: [] };
  const meta: PaginationMeta = {
    hasNext: true,
    hasPrevious: true,
    limit: 1,
    offset: 1,
    page: 2,
    total: 3,
    totalPages: 3,
  };
  const links: PaginationLinks = {
    first: "?page=1",
    last: "?page=3",
    next: "?page=3",
    previous: "?page=1",
    self: "?page=2",
  };
  const collection: Collection<WorkingDomainSlug> = {
    data: ["engineering"],
    links,
    meta: { ...meta, aggregations },
  };
  expect(collection.meta.aggregations?.domain).toEqual([bucket]);
  expect(collection.links.previous).toBe("?page=1");
  expect(collection.links.next).toBe("?page=3");

  const empty: Collection<never> = {
    data: [],
    links: { first: "?page=1", last: "?page=1", self: "?page=1" },
    meta: {
      ...meta,
      hasNext: false,
      hasPrevious: false,
      offset: 0,
      page: 1,
      total: 0,
      totalPages: 0,
    },
  };
  expect(empty.data).toEqual([]);
  expect(empty.meta.aggregations).toBeUndefined();
  expect(empty.links.next).toBeUndefined();
  expect(empty.links.previous).toBeUndefined();
});

test("working domains expose the supported slug and label pairs", () => {
  expect(WORKING_DOMAINS).toEqual([
    { label: "Engineering", slug: "engineering" },
    { label: "Finance", slug: "finance" },
    { label: "Industry", slug: "industry" },
    { label: "Logistic", slug: "logistic" },
    { label: "Marketing", slug: "marketing" },
    { label: "Operation", slug: "operation" },
    { label: "Research", slug: "research" },
    { label: "Sales", slug: "sales" },
    { label: "Supply chain", slug: "supply-chain" },
  ]);
});
