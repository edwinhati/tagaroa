import { describe, expect, test } from "bun:test";

import { asObject, messageFor } from "./index";
import type { ObjectLike } from "./index";

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
