import { describe, expect, test } from "bun:test";

import { editTemplateBody, templateDraftBody } from "./notification.schemas";

const valid = {
  body: "Hello {{name}}",
  channel: "sms" as const,
  key: " account.issued ",
  locale: "en",
  secrets: [],
  subject: null,
  variables: ["name"],
};

const message = (input: unknown) => {
  const result = templateDraftBody.safeParse(input);
  return result.success ? undefined : result.error.issues[0]!.message;
};

describe("templateDraftBody", () => {
  test("trims text and gives what TemplateDraft takes", () => {
    expect(templateDraftBody.parse(valid)).toEqual({
      ...valid,
      key: "account.issued",
    });
  });

  test("absent or null lists and subject read as empty", () => {
    const { body, channel, key, locale } = valid;
    const rest = { body, channel, key, locale };
    expect(templateDraftBody.parse(rest)).toMatchObject({
      secrets: [],
      subject: null,
      variables: [],
    });
    expect(
      templateDraftBody.parse({ ...rest, secrets: null, variables: null }),
    ).toMatchObject({ secrets: [], variables: [] });
  });

  test("keeps the sentences TemplateDraft used", () => {
    expect(message({ ...valid, key: "  " })).toBe("key is required");
    expect(message({ ...valid, channel: "pigeon" })).toBe(
      "channel must be one of email, sms, whatsapp",
    );
    expect(message({ ...valid, body: 3 })).toBe("body is required");
    expect(message({ ...valid, variables: [1] })).toBe(
      "variables must be a list of names",
    );
    expect(message({ ...valid, secrets: "token" })).toBe(
      "secrets must be a list of names",
    );
    expect(message({ ...valid, locale: undefined })).toBe("locale is required");
    expect(message({ ...valid, subject: 5 })).toBe("subject must be text");
  });

  test("a body that is not an object is a 400 sentence, not a crash", () => {
    expect(message("nope")).toBe("A template is required");
    expect(message(undefined)).toBe("A template is required");
  });
});

describe("editTemplateBody", () => {
  test("parses the version being edited", () => {
    expect(
      editTemplateBody
        .parse({ ...valid, expectedUpdatedAt: "2026-01-01T00:00:00.123Z" })
        .expectedUpdatedAt.toISOString(),
    ).toBe("2026-01-01T00:00:00.123Z");
  });

  test("a missing or unreadable timestamp is refused", () => {
    for (const expectedUpdatedAt of [undefined, "not-a-date", 5]) {
      const result = editTemplateBody.safeParse({
        ...valid,
        expectedUpdatedAt,
      });
      expect(result.error?.issues[0]?.message).toBe(
        "expectedUpdatedAt must be a valid timestamp",
      );
    }
  });
});
