import { describe, expect, test } from "bun:test";

import { savePositionBody } from "./directory.schemas";

const message = (input: unknown) => {
  const result = savePositionBody.safeParse(input);
  return result.success ? undefined : result.error.issues[0]!.message;
};

describe("savePositionBody", () => {
  test("trims the title and treats an absent, null or empty manager as none", () => {
    expect(savePositionBody.parse({ title: "  Staff engineer  " })).toEqual({
      managerUserId: null,
      title: "Staff engineer",
    });
    for (const managerUserId of [null, ""]) {
      expect(
        savePositionBody.parse({ managerUserId, title: "Engineer" })
          .managerUserId,
      ).toBeNull();
    }
    expect(
      savePositionBody.parse({ managerUserId: "grace", title: "Engineer" })
        .managerUserId,
    ).toBe("grace");
  });

  test("keeps the sentences the use case used", () => {
    expect(message({})).toBe("Title is required.");
    expect(message({ title: "   " })).toBe("Title is required.");
    expect(message({ title: 7 })).toBe("Title is required.");
    expect(message({ title: "x".repeat(121) })).toBe(
      "Title must be 120 characters or fewer.",
    );
    expect(message({ title: ` ${"x".repeat(120)} ` })).toBeUndefined();
  });

  test("a manager that is not a string is a 400 sentence", () => {
    expect(message({ managerUserId: 5, title: "Engineer" })).toBe(
      "Manager must be a person ID.",
    );
  });

  test("a body that is not an object is a 400 sentence, not a crash", () => {
    expect(message("nope")).toBe("Request body must be a JSON object.");
    expect(message(undefined)).toBe("Request body must be a JSON object.");
  });
});
