/**
 * The roles one person holds.
 *
 * Better Auth stores them comma-separated in a single column, so "holds a role"
 * is a parse before it is a comparison — and the parse is exactly where the
 * mistake worth guarding against lives. Matching the raw column against
 * `"admin"` by substring would promote an `"administrator"`, and matching it
 * whole would refuse a legitimate `"user,admin"`.
 */
export class Roles {
  private constructor(private readonly held: readonly string[]) {}

  static parse(column: string | null): Roles {
    return new Roles(
      (column ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
  }

  get names(): string[] {
    return [...this.held];
  }

  /** Group-wide privilege: every role admitted to the identity back office. */
  get privileged(): boolean {
    return this.held.some((entry) =>
      ["access-reviewer", "helpdesk", "admin", "super-admin"].includes(entry),
    );
  }
}
