import type { Database } from "../../../../../platform/database/database.module";

/** The handle a `database.transaction` callback is given. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Whatever the statements run against: the pool, or one open transaction.
 *
 * Every repository below takes one of these rather than reaching for `DATABASE`
 * itself, which is what lets the same class serve a lone read and a step inside
 * `DrizzleNotificationUnitOfWork` without a second implementation.
 *
 * Drizzle's transaction handle carries the same query builders as the database
 * it came from but does not share its type, and a union of the two resolves to
 * a union of call signatures that its generics cannot see through. So the unit
 * of work casts once, at the point it opens the transaction, and the type is
 * stated here rather than left implicit at five call sites.
 */
export type Executor = Database;
