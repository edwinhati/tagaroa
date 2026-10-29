import { describe, expect, test } from "bun:test";

import { asObject, messageFor } from "./index";
import type { ApiDocument, Collection } from "./index";

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
