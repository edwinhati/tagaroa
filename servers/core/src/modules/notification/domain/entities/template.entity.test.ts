import { expect, test } from "bun:test";

import { Template } from "./template.entity";

const wording = (key: string) =>
  Template.restore({
    body: "Address: {{email}}\nTemporary password: {{password}}",
    channel: "email",
    id: "template",
    key,
    locale: "en",
    secrets: [],
    status: "published",
    subject: "Your {{product}} account",
    updatedAt: new Date(0),
    variables: ["email", "password"],
    version: 2,
  });

const variables = {
  email: "ada@tagaroa.com",
  password: "hunter2-hunter2",
  product: "Tagaroa",
};

test.each(["account.issued", "account.password-reset"])(
  "%s keeps the password out of the payload even when the row declares no secrets",
  (key) => {
    const rendered = wording(key).render(variables);

    expect(JSON.stringify(rendered.payload)).not.toContain("hunter2-hunter2");
    expect(rendered.payload.body).toContain("Temporary password: {{password}}");
    expect(rendered.secrets).toEqual({ password: "hunter2-hunter2" });
  },
);

test("other keys mask only what their row declares", () => {
  expect(wording("account.welcome").render(variables).secrets).toBeNull();
});
