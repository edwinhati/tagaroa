import { customType } from "drizzle-orm/pg-core";

/**
 * `jsonb`, written as JSON rather than as a string containing JSON.
 *
 * Drizzle's own `jsonb` calls `JSON.stringify` on the way to the driver, which
 * is right for `postgres.js` and wrong for `bun-sql`: Bun's `SQL` serialises
 * the value itself, so the column ends up holding a JSON *string* whose
 * contents happen to be JSON. Reads hid it — Bun hands the text back and
 * Drizzle parses it once, so entities looked correct — but the value in the
 * database was `"{\"body\":…}"`, a scalar. Every SQL-level expression against
 * it returns null, which is why the delivery log's "What was sent" was empty
 * while the same message rendered and sent correctly.
 *
 * Migration `0011` repairs the rows written before this existed.
 */
export const jsonb = <T>(name: string) =>
  customType<{ data: T; driverData: unknown }>({
    dataType: () => "jsonb",
    /** Bun's `SQL` serialises this; stringifying first is the double encode. */
    toDriver: (value) => value,
    /**
     * Bun returns `jsonb` as text on some paths and as a parsed value on
     * others, so this accepts either rather than assuming one.
     */
    fromDriver: (value) => {
      if (typeof value !== "string") return value as T;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    },
  })(name);
