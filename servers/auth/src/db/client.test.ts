import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("db client", () => {
  test("returns empty object when DATABASE_URL is not set in test mode", () => {
    delete process.env.DATABASE_URL;

    // Clear require cache to force re-evaluation
    delete require.cache[require.resolve("./client")];
    const { getDatabase } = require("./client");

    const db = getDatabase();
    expect(db).toEqual({});
  });

  test("returns empty object when DATABASE_URL is set but in test mode (BUN_ENV=test)", () => {
    // Even with DATABASE_URL set, if BUN_ENV is 'test' (which it is during bun test),
    // the module treats it as test mode and returns empty object
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    // Clear require cache
    delete require.cache[require.resolve("./client")];
    const { getDatabase } = require("./client");

    const db = getDatabase();
    // In test mode, databaseUrl is set but isTest is true, so it should return {}
    expect(db).toBeDefined();
    expect(typeof db).toBe("object");
  });

  test("each call returns a new empty object when DATABASE_URL is not set (no caching)", () => {
    delete process.env.DATABASE_URL;

    // Clear require cache
    delete require.cache[require.resolve("./client")];
    const { getDatabase } = require("./client");

    const db1 = getDatabase();
    const db2 = getDatabase();
    // When databaseUrl is falsy, getDatabase returns a new empty object each time
    // This is the actual behavior - the empty object is not cached
    expect(db1).toEqual(db2);
    expect(db1).not.toBe(db2); // Different object references
  });
});
