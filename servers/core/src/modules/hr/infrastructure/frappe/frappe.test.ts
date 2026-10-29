import { expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import type { Employee } from "../../domain/employee";
import { toEmployee, verifyFrappeSignature } from "./frappe";

const joiner: Employee = {
  companyEmail: "ada@tagaroa.example",
  displayName: "Ada Lovelace",
  name: "HR-EMP-00001",
  personalEmail: "ada@home.example",
  relievingDate: null,
  status: "Active",
};

test("an employee record is read field by field", () => {
  expect(
    toEmployee({
      company_email: " Ada@Tagaroa.Example ",
      employee_name: "Ada Lovelace",
      name: "HR-EMP-00001",
      personal_email: "ada@home.example",
      relieving_date: null,
      status: "Active",
    }),
  ).toEqual(joiner);
  expect(toEmployee({ name: "HR-EMP-00001" })).toBeUndefined();
  expect(toEmployee("HR-EMP-00001")).toBeUndefined();
});

test("Frappe's signature is checked against the exact body", () => {
  const body = '{"name":"HR-EMP-00001"}';
  const signature = createHmac("sha256", "secret")
    .update(body)
    .digest("base64");

  expect(verifyFrappeSignature("secret", body, signature)).toBe(true);
  expect(verifyFrappeSignature("other", body, signature)).toBe(false);
  expect(
    verifyFrappeSignature("secret", '{"name":"HR-EMP-00002"}', signature),
  ).toBe(false);
  expect(verifyFrappeSignature("secret", body, "")).toBe(false);
});
