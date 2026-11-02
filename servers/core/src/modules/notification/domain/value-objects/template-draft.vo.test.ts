import { expect, test } from "bun:test";

import { TemplateDraft } from "./template-draft.vo";

/** The parse under test; the value object is what proves it ran. */
const parseTemplateDraft = (input: unknown) =>
  TemplateDraft.parse(input).fields;

const email = {
  body: "Sign in with {{password}}.",
  channel: "email",
  key: "account.issued",
  locale: "en",
  subject: "Your account",
};

test("accepts an email draft and drops nothing", () => {
  expect(parseTemplateDraft(email)).toEqual({
    body: "Sign in with {{password}}.",
    channel: "email",
    key: "account.issued",
    locale: "en",
    secrets: [],
    subject: "Your account",
    variables: [],
  });
});

test("a secret must name a variable the template declares", () => {
  expect(
    parseTemplateDraft({
      ...email,
      secrets: ["password"],
      variables: ["name", "password"],
    }).secrets,
  ).toEqual(["password"]);

  expect(() =>
    parseTemplateDraft({
      ...email,
      secrets: ["password"],
      variables: ["name"],
    }),
  ).toThrow("secrets must name variables this template declares: password");
});

test("refuses a WhatsApp secret, whose parameters are positional", () => {
  expect(() =>
    parseTemplateDraft({
      body: "account_issued",
      channel: "whatsapp",
      key: "account.issued",
      locale: "en",
      secrets: ["password"],
      variables: ["password"],
    }),
  ).toThrow("A WhatsApp template cannot carry a secret variable");
});

test("refuses an email with no subject line", () => {
  expect(() => parseTemplateDraft({ ...email, subject: " " })).toThrow(
    "subject is required",
  );
});

test("refuses a WhatsApp body that is a sentence rather than a template name", () => {
  expect(() =>
    parseTemplateDraft({
      body: "Hello there!",
      channel: "whatsapp",
      key: "account.issued",
      locale: "en",
    }),
  ).toThrow("approved template's name");

  expect(
    parseTemplateDraft({
      body: "account_issued",
      channel: "whatsapp",
      key: "account.issued",
      locale: "en",
      variables: ["name"],
    }),
  ).toMatchObject({
    body: "account_issued",
    subject: null,
    variables: ["name"],
  });
});

test("refuses an unknown channel and a malformed key", () => {
  expect(() => parseTemplateDraft({ ...email, channel: "pigeon" })).toThrow(
    "channel must be one of",
  );
  expect(() => parseTemplateDraft({ ...email, key: "Account Issued" })).toThrow(
    "account.issued",
  );
});

test("accepts an SMS draft and keeps no subject", () => {
  expect(
    parseTemplateDraft({
      body: "Your code is {{code}}.",
      channel: "sms",
      key: "account.code",
      locale: "en",
      subject: "Ignored",
      variables: ["code"],
    }),
  ).toMatchObject({ channel: "sms", subject: null, variables: ["code"] });
});

test("refuses an SMS draft with no body", () => {
  expect(() =>
    parseTemplateDraft({
      body: "  ",
      channel: "sms",
      key: "account.code",
      locale: "en",
    }),
  ).toThrow("body is required");
});

test("refuses a missing draft, a missing locale and non-string names", () => {
  expect(() => parseTemplateDraft(null)).toThrow("A template is required");
  expect(() => parseTemplateDraft({ ...email, locale: undefined })).toThrow(
    "locale is required",
  );
  expect(() => parseTemplateDraft({ ...email, variables: [1] })).toThrow(
    "variables must be a list of names",
  );
  expect(() =>
    parseTemplateDraft({ ...email, secrets: [1], variables: ["name"] }),
  ).toThrow("secrets must be a list of names");
});
