import { createHmac, timingSafeEqual } from "node:crypto";

import { asObject } from "@repo/contracts";

import type { Employee } from "../../domain/employee";
import type { EmployeeSource } from "../../domain/repositories/employee-source.port";

export interface FrappeOptions {
  url: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Frappe signs the body as base64 HMAC-SHA256 with the webhook secret. There is
 * no timestamp, so a request can be replayed; that is harmless here because a
 * webhook only names an employee, and the record itself is re-read from Frappe.
 */
export const verifyFrappeSignature = (
  secret: string,
  payload: string,
  signature: string,
): boolean => {
  const expected = Buffer.from(
    createHmac("sha256", secret).update(payload).digest("base64"),
  );
  const candidate = Buffer.from(signature);
  return (
    expected.length === candidate.length && timingSafeEqual(expected, candidate)
  );
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

/** Anything Frappe sends is read field by field, never trusted whole. */
export const toEmployee = (value: unknown): Employee | undefined => {
  const record = asObject(value);
  const name = text(record?.name);
  const status = text(record?.status);
  if (!record || !name || !status) return undefined;
  return {
    companyEmail: text(record.company_email)?.toLowerCase() ?? null,
    displayName: text(record.employee_name),
    name,
    personalEmail: text(record.personal_email),
    relievingDate: text(record.relieving_date),
    status,
  };
};

const FIELDS = [
  "name",
  "employee_name",
  "status",
  "company_email",
  "personal_email",
  "relieving_date",
];
const PAGE = 500;

/** Frappe HR's REST API as the module's `EmployeeSource`. */
export const frappeEmployees = (options: FrappeOptions): EmployeeSource => {
  const get = async (path: string): Promise<unknown> => {
    const response = await fetch(`${options.url}${path}`, {
      headers: {
        accept: "application/json",
        authorization: `token ${options.apiKey}:${options.apiSecret}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return undefined;
    if (!response.ok)
      throw new Error(`Frappe answered ${response.status} for ${path}`);
    return asObject(await response.json())?.data;
  };

  return {
    employee: async (name: string): Promise<Employee | undefined> =>
      // Frappe 16 routes a document at a trailing slash; without it the
      // request is redirected first.
      toEmployee(
        await get(`/api/resource/Employee/${encodeURIComponent(name)}/`),
      ),

    async employees(): Promise<Employee[]> {
      const all: Employee[] = [];
      for (let start = 0; ; start += PAGE) {
        const query = new URLSearchParams({
          fields: JSON.stringify(FIELDS),
          limit_page_length: String(PAGE),
          limit_start: String(start),
          order_by: "name asc",
        });
        const page = await get(`/api/resource/Employee?${query}`);
        if (!Array.isArray(page)) break;
        for (const row of page) {
          const employee = toEmployee(row);
          if (employee) all.push(employee);
        }
        if (page.length < PAGE) break;
      }
      return all;
    },
  };
};
