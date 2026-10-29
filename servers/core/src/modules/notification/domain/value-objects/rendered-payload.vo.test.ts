import { expect, test } from "bun:test";

import { renderTemplate, renderText } from "./rendered-payload.vo";

test("substitutes every occurrence, spaced or not", () => {
  expect(renderText("Hi {{name}}, bye {{ name }}", { name: "Ada" })).toBe(
    "Hi Ada, bye Ada",
  );
});

test("refuses to render a variable it was not given", () => {
  expect(() => renderText("Hi {{name}}", {})).toThrow(
    'Template variable "name" was not supplied',
  );
});

test("renders an email subject and body", () => {
  expect(
    renderTemplate(
      {
        channel: "email",
        subject: "Your {{product}} account",
        body: "Sign in with {{password}}.",
        secrets: [],
        variables: [],
      },
      { password: "hunter2", product: "Tagaroa" },
    ),
  ).toEqual({
    payload: {
      subject: "Your Tagaroa account",
      body: "Sign in with hunter2.",
      variables: [],
    },
    secrets: null,
  });
});

test("a declared secret stays a placeholder in the payload and travels apart", () => {
  const rendered = renderTemplate(
    {
      channel: "email",
      subject: "Your {{product}} account",
      body: "Address: {{email}}\nTemporary password: {{password}}",
      secrets: ["password"],
      variables: [],
    },
    {
      email: "ada@tagaroa.com",
      password: "hunter2-hunter2",
      product: "Tagaroa",
    },
  );

  // What is safe to keep: the shape of the message, with the credential's place
  // visible and its value absent.
  expect(rendered.payload).toEqual({
    subject: "Your Tagaroa account",
    body: "Address: ada@tagaroa.com\nTemporary password: {{password}}",
    variables: [],
  });
  expect(rendered.payload.body).not.toContain("hunter2-hunter2");
  expect(rendered.secrets).toEqual({ password: "hunter2-hunter2" });
});

test("a secret in the subject is withheld from it too", () => {
  expect(
    renderTemplate(
      {
        channel: "email",
        subject: "Code {{code}}",
        body: "Code {{code}}",
        secrets: ["code"],
        variables: [],
      },
      { code: "123456" },
    ).payload.subject,
  ).toBe("Code {{code}}");
});

test("a secret the caller never supplied leaves nothing to withhold", () => {
  expect(
    renderTemplate(
      {
        channel: "sms",
        subject: null,
        body: "Nothing secret here",
        secrets: ["password"],
        variables: [],
      },
      {},
    ).secrets,
  ).toBeNull();
});

test("keeps a WhatsApp template name intact and orders its parameters", () => {
  expect(
    renderTemplate(
      {
        channel: "whatsapp",
        subject: null,
        body: "account_issued",
        secrets: [],
        variables: ["name", "password"],
      },
      { name: "Ada", password: "hunter2" },
    ),
  ).toEqual({
    payload: {
      subject: null,
      body: "account_issued",
      variables: ["Ada", "hunter2"],
    },
    secrets: null,
  });
});

test("refuses a WhatsApp secret, whose parameters are positional", () => {
  expect(() =>
    renderTemplate(
      {
        channel: "whatsapp",
        subject: null,
        body: "account_issued",
        secrets: ["password"],
        variables: ["password"],
      },
      { password: "hunter2" },
    ),
  ).toThrow("A WhatsApp template cannot carry a secret variable");
});

test("an SMS carries no subject even when the row has one", () => {
  expect(
    renderTemplate(
      {
        channel: "sms",
        subject: "ignored",
        body: "Code {{code}}",
        secrets: [],
        variables: [],
      },
      { code: "123456" },
    ).payload.subject,
  ).toBeNull();
});
