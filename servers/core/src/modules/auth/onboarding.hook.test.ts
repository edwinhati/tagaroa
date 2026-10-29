import { expect, test } from "bun:test";

import { issuedNotification, resetNotification } from "./onboarding.hook";

test("addresses an issued account by name, with its temporary password", () => {
  expect(
    issuedNotification(
      {
        data: { personalEmail: "ada@personal.example" },
        email: "ada@tagaroa.com",
        password: "hunter2-hunter2",
      },
      { user: { email: "ada@tagaroa.com", id: "u1", name: "Ada Lovelace" } },
    ),
  ).toEqual({
    // The personal address, because there is no workspace mailbox to read yet.
    to: "ada@personal.example",
    variables: {
      // The workspace address still travels in the message: it is the one they
      // sign in with.
      email: "ada@tagaroa.com",
      name: "Ada Lovelace",
      password: "hunter2-hunter2",
    },
  });
});

test("falls back to the address when the account has no name", () => {
  expect(
    issuedNotification(
      {
        data: { personalEmail: "ada@personal.example" },
        password: "hunter2-hunter2",
      },
      { user: { email: "ada@tagaroa.com", name: "  " } },
    )?.variables.name,
  ).toBe("ada@tagaroa.com");
});

test("sends nothing when the response carries no account", () => {
  expect(issuedNotification({ password: "hunter2" }, {})).toBeUndefined();
  expect(
    issuedNotification({}, { user: { email: "ada@tagaroa.com" } }),
  ).toBeUndefined();
});

test("sends nothing when no personal address was supplied", () => {
  expect(
    issuedNotification(
      { email: "ada@tagaroa.com", password: "hunter2-hunter2" },
      { user: { email: "ada@tagaroa.com", id: "u1", name: "Ada Lovelace" } },
    ),
  ).toBeUndefined();
});

test("a reissued password is addressed to the personal address on file", () => {
  expect(
    resetNotification(
      { newPassword: "second-password", userId: "u1" },
      {
        email: "ada@tagaroa.com",
        name: null,
        personalEmail: "ada@personal.example",
      },
    ),
  ).toEqual({
    to: "ada@personal.example",
    variables: {
      email: "ada@tagaroa.com",
      name: "ada@tagaroa.com",
      password: "second-password",
    },
  });
});

test("sends nothing for a user id that matches no account", () => {
  expect(
    resetNotification({ newPassword: "second-password" }, undefined),
  ).toBeUndefined();
});

test("sends nothing for an account recorded before personal addresses were", () => {
  expect(
    resetNotification(
      { newPassword: "second-password", userId: "u1" },
      { email: "ada@tagaroa.com", name: null, personalEmail: null },
    ),
  ).toBeUndefined();
});
