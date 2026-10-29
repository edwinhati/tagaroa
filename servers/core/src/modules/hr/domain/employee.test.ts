import { expect, test } from "bun:test";

import { decide, type Employee } from "./employee";

const today = "2026-10-26";
const joiner: Employee = {
  companyEmail: "ada@tagaroa.example",
  displayName: "Ada Lovelace",
  name: "HR-EMP-00001",
  personalEmail: "ada@home.example",
  relievingDate: null,
  status: "Active",
};
const leaver: Employee = {
  ...joiner,
  relievingDate: today,
  status: "Left",
};

test("an active employee with no account is issued one", () => {
  expect(decide(joiner, null, today)).toEqual({ kind: "issue" });
});

test("an employee is not issued an account without both addresses", () => {
  expect(decide({ ...joiner, personalEmail: null }, null, today).kind).toBe(
    "none",
  );
  expect(decide({ ...joiner, companyEmail: null }, null, today).kind).toBe(
    "none",
  );
  // The temporary password must not go to the mailbox it unlocks.
  expect(
    decide({ ...joiner, personalEmail: "Ada@Tagaroa.example" }, null, today),
  ).toEqual({
    kind: "none",
    reason: "Its personal email is the company email",
  });
});

test("a suspended account is never restored by an HR record", () => {
  expect(decide(joiner, { banned: true }, today)).toEqual({
    kind: "none",
    reason: "Active in HR but suspended here",
  });
});

test("a leaver is offboarded on their relieving date, not before", () => {
  expect(decide(leaver, { banned: false }, today)).toEqual({
    kind: "offboard",
  });
  expect(
    decide({ ...leaver, relievingDate: "2026-10-27" }, { banned: false }, today)
      .kind,
  ).toBe("none");
  expect(
    decide({ ...leaver, relievingDate: null }, { banned: false }, today).kind,
  ).toBe("offboard");
});

test("nothing happens to an account that is already offboarded or never existed", () => {
  expect(decide(leaver, { banned: true }, today).kind).toBe("none");
  expect(decide(leaver, null, today).kind).toBe("none");
  expect(decide({ ...joiner, status: "Suspended" }, null, today).kind).toBe(
    "none",
  );
});
