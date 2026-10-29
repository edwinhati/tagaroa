import type { Person } from "../entities/person.entity";

export const PERSON_REPOSITORY = Symbol("PERSON_REPOSITORY");

/** One identity provider a person can sign in with. */
export interface LinkedAccount {
  id: string;
  accountId: string;
  providerId: string;
  createdAt: Date;
}

/**
 * The people in the group, read-only.
 *
 * Read-only is the contract, not an omission. Better Auth owns every write to
 * these tables, and a `save` here would be a second way to change an account
 * that its own hooks and audit trail would never see.
 */
export interface PersonRepository {
  listAll(): Promise<Person[]>;
  /** Display names for the given ids. Missing ids are omitted. */
  displayNamesOf(userIds: string[]): Promise<Map<string, string>>;
  linkedAccountsOf(userId: string): Promise<LinkedAccount[]>;
  countLinkedAccounts(): Promise<number>;
  /**
   * Where onboarding reaches one person, asked one person at a time.
   *
   * Deliberately not part of `Person`, and so absent from `listAll`. Better
   * Auth keeps the column out of every response it writes, and a listing that
   * carried it would put every member of staff's private address into every
   * admin's browser to answer a question about one of them.
   */
  personalEmailOf(userId: string): Promise<string | null>;
}
