import { expect, test } from "bun:test";

import { QueuedMessage } from "./queued-message.entity";

const claimed = (
  payload: { body: string; subject: string | null },
  secrets: Record<string, string> | null,
) =>
  QueuedMessage.restore({
    attempts: 1,
    channel: "email",
    destination: "ada@personal.example",
    id: "m1",
    locale: "en",
    payload: { ...payload, variables: [] },
    claimedAt: new Date(0),
    secrets,
  });

test("puts the secret back only on the way to the carrier", () => {
  const message = claimed(
    {
      body: "Temporary password: {{password}}",
      subject: "Your Tagaroa account",
    },
    { password: "hunter2-hunter2" },
  );

  expect(message.outgoingPayload.body).toBe(
    "Temporary password: hunter2-hunter2",
  );
  // The stored payload is untouched by the reassembly: what the log keeps and
  // what the recipient reads are different things on purpose.
  expect(message.payload.body).toBe("Temporary password: {{password}}");
});

test("a secret in the subject is restored too", () => {
  expect(
    claimed(
      { body: "Code {{code}}", subject: "Code {{code}}" },
      {
        code: "123456",
      },
    ).outgoingPayload.subject,
  ).toBe("Code 123456");
});

test("an ordinary message passes through untouched", () => {
  const message = claimed(
    { body: "Nothing withheld here", subject: "Hello" },
    null,
  );

  expect(message.outgoingPayload).toEqual({
    body: "Nothing withheld here",
    subject: "Hello",
    variables: [],
  });
});

test("refuses to send a credential it no longer holds", () => {
  // Cleared once the message left, so a second attempt has nothing to put back.
  // Throwing is the right answer: sending a literal "{{password}}" would be a
  // message that looks delivered and is useless.
  expect(
    () =>
      claimed(
        { body: "Temporary password: {{password}}", subject: "Account" },
        null,
      ).outgoingPayload,
  ).toThrow('Template variable "password" was not supplied');
});

test("a value that reads like a placeholder goes out as written", () => {
  // Rendered at enqueue from a display name of "Ana {{team}}".
  expect(
    claimed(
      { body: "Ana {{team}}, your password: {{password}}", subject: null },
      { password: "hunter2-hunter2" },
    ).outgoingPayload.body,
  ).toBe("Ana {{team}}, your password: hunter2-hunter2");
  expect(
    claimed({ body: "Hello Ana {{ team }}", subject: "Hi {{x}}" }, null)
      .outgoingPayload,
  ).toEqual({
    body: "Hello Ana {{ team }}",
    subject: "Hi {{x}}",
    variables: [],
  });
});
