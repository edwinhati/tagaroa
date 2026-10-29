export const EMPLOYEE_LINKS = Symbol("EMPLOYEE_LINKS");

/**
 * Which account belongs to which HR record. Keyed by the HR record's id rather
 * than the company email, so changing someone's address in HR does not cut
 * them loose from their account. One record, one account, both ways.
 */
export interface EmployeeLinkRepository {
  accountFor(employee: string): Promise<string | null>;
  employeeFor(accountId: string): Promise<string | null>;
  link(employee: string, accountId: string): Promise<void>;
}
