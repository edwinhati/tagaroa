/** The part of a Frappe HR Employee record that decides an account. */
export interface Employee {
  /** Frappe's id for the record, e.g. `HR-EMP-00001`. */
  name: string;
  displayName: string | null;
  /** `Active`, `Inactive`, `Suspended` or `Left`. */
  status: string;
  /** The workspace address. It is what the account signs in with. */
  companyEmail: string | null;
  /** Where the temporary password goes. See ADR 0001. */
  personalEmail: string | null;
  /** `YYYY-MM-DD`, set once someone is leaving. */
  relievingDate: string | null;
}

export type Action =
  | { kind: "issue" }
  | { kind: "offboard" }
  | { kind: "none"; reason?: string };

/**
 * What one employee record means for the account linked to it.
 *
 * Only the two safe directions are automatic. An account HR shows as active
 * but Tagaroa has suspended stays suspended: restoring access is a decision
 * for an administrator, not a side effect of a record being edited.
 */
export const decide = (
  employee: Employee,
  account: { banned: boolean } | null,
  today: string,
): Action => {
  if (employee.status === "Left") {
    if (!account || account.banned) return { kind: "none" };
    if (employee.relievingDate && employee.relievingDate > today)
      return {
        kind: "none",
        reason: `Leaves on ${employee.relievingDate}`,
      };
    return { kind: "offboard" };
  }
  if (employee.status !== "Active") return { kind: "none" };
  if (account)
    return account.banned
      ? { kind: "none", reason: "Active in HR but suspended here" }
      : { kind: "none" };
  if (!employee.companyEmail || !employee.personalEmail)
    return {
      kind: "none",
      reason: "Needs both a company and a personal email",
    };
  if (employee.personalEmail.toLowerCase() === employee.companyEmail)
    return {
      kind: "none",
      reason: "Its personal email is the company email",
    };
  return { kind: "issue" };
};
