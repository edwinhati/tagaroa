import { describe, expect, it } from "bun:test";
import { AccountCategory } from "../value-objects/account-category";
import { Account } from "./account.entity";

describe("Account Entity", () => {
  it("withUpdatedBalance should not increment the version (repository handles versioning)", () => {
    const account = new Account(
      "id-1",
      "Test Account",
      "BANK",
      "ASSET" as AccountCategory,
      1000,
      "user-id-1",
      "USD",
      null,
      null,
      null,
      new Date(),
      new Date(),
      5, // current version is 5
    );

    const updatedAccount = account.withUpdatedBalance(1100);

    expect(updatedAccount.balance).toBe(1100);
    expect(updatedAccount.version).toBe(5); // Should remain 5
  });
});
