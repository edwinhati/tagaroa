import type { Employee } from "../employee";

export const EMPLOYEE_SOURCE = Symbol("EMPLOYEE_SOURCE");

/** The HR system of record, read-only. Today that is Frappe HR. */
export interface EmployeeSource {
  /** Undefined when the record does not exist (or no longer does). */
  employee(name: string): Promise<Employee | undefined>;
  employees(): Promise<Employee[]>;
}
