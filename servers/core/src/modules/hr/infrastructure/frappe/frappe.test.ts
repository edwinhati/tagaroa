import { afterEach, expect, spyOn, test } from "bun:test";
import { createHmac } from "node:crypto";

import type { Employee } from "../../domain/employee";
import { frappeEmployees, toEmployee, verifyFrappeSignature } from "./frappe";

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

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

test("a Pangolin access token goes out as Pangolin's token headers", async () => {
  const fetch = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ data: null }))
    .mockResolvedValueOnce(Response.json({ data: null }));
  const options = { apiKey: "k", apiSecret: "s", url: "https://hr.example" };

  await frappeEmployees({ ...options, accessToken: "abc.def" }).employee("E1");
  await frappeEmployees(options).employee("E1");

  const headers = fetch.mock.calls.map(
    ([, init]) => init?.headers as Record<string, string>,
  );
  expect(headers[0]).toMatchObject({
    "p-access-token": "def",
    "p-access-token-id": "abc",
  });
  expect(headers[1]).not.toHaveProperty("p-access-token");
});
