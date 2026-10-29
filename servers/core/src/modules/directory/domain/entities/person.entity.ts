import { Roles } from "../value-objects/roles.vo";

const DAY = 24 * 60 * 60 * 1000;

/** How long an unverified account may sit before it is worth raising. */
const UNVERIFIED_GRACE_DAYS = 7;

export const ageInDays = (value: Date, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - value.getTime()) / DAY));

export type AttentionKind =
  | "temporary-password"
  | "unverified-email"
  | "no-subsidiary";

export interface AttentionIssue {
  userId: string;
  name: string;
  email: string;
  ageDays: number;
  kind: AttentionKind;
}

export interface PersonProps {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  emailVerified: boolean;
  mustChangePassword: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One person, as the group's administrator sees them.
 *
 * A projection of the `auth` tables rather than a second model of them: nothing
 * here is ever written, so Better Auth regenerating its schema can change what
 * this reads but never what this owns. Identity writes stay with Better Auth.
 *
 * The rules are methods because every one of them is a question an operator
 * asks of a single person — is this account privileged, does it need attention,
 * how long has it been like this — and each is answerable without a database.
 */
export class Person {
  private constructor(private readonly props: PersonProps) {}

  static restore(props: PersonProps): Person {
    return new Person(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): string {
    return this.props.email;
  }

  get role(): string | null {
    return this.props.role;
  }

  get banned(): boolean {
    return Boolean(this.props.banned);
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** A role edit moves this, which is what makes a stale review detectable. */
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get roles(): Roles {
    return Roles.parse(this.props.role);
  }

  get privileged(): boolean {
    return this.roles.privileged;
  }

  /**
   * Everything about this person an operator should act on.
   *
   * A banned account raises nothing: it is already the answer, and listing it
   * beside the accounts that still need a decision buries the ones that do.
   */
  attention(hasSubsidiary: boolean, now: Date): AttentionIssue[] {
    if (this.banned) return [];

    const common = {
      ageDays: ageInDays(this.props.updatedAt, now),
      email: this.props.email,
      name: this.props.name,
      userId: this.props.id,
    };

    const issues: AttentionIssue[] = [];
    if (this.props.mustChangePassword) {
      issues.push({ ...common, kind: "temporary-password" });
    }
    if (
      !this.props.emailVerified &&
      ageInDays(this.props.createdAt, now) >= UNVERIFIED_GRACE_DAYS
    ) {
      issues.push({
        ...common,
        ageDays: ageInDays(this.props.createdAt, now),
        kind: "unverified-email",
      });
    }
    if (!hasSubsidiary) {
      issues.push({ ...common, kind: "no-subsidiary" });
    }
    return issues;
  }
}
