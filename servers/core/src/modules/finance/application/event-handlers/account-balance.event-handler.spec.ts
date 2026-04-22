import { beforeEach, describe, expect, it, jest } from "bun:test";
import "reflect-metadata";
import { Test, TestingModule } from "@nestjs/testing";
import { Account } from "../../domain/entities/account.entity";
import { ACCOUNT_REPOSITORY } from "../../domain/repositories/account.repository.interface";
import { AccountCategory } from "../../domain/value-objects/account-category";
import { AccountBalanceEventHandler } from "./account-balance.event-handler";

describe("AccountBalanceEventHandler", () => {
  let handler: AccountBalanceEventHandler;
  let accountRepo: { findById: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    accountRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountBalanceEventHandler,
        {
          provide: ACCOUNT_REPOSITORY,
          useValue: accountRepo,
        },
      ],
    }).compile();

    handler = module.get<AccountBalanceEventHandler>(
      AccountBalanceEventHandler,
    );
  });

  it("should clear locks from the map after processing", async () => {
    const accountId = "acc-1";
    const account = new Account(
      accountId,
      "Test",
      "BANK",
      "ASSET" as AccountCategory,
      1000,
      "user-1",
      "USD",
      null,
      null,
      null,
      new Date(),
      new Date(),
      1,
    );

    accountRepo.findById.mockResolvedValue(account);
    accountRepo.update.mockResolvedValue(account);

    // Call handleCreated
    await handler.handleCreated({
      accountId,
      amount: 100,
      type: "INCOME",
      userId: "user-1",
      transactionId: "tx-1",
      categoryId: "cat-1",
      date: new Date(),
    } as unknown as Parameters<AccountBalanceEventHandler["handleCreated"]>[0]);

    // Check if locks are cleared. Since it's private, we access it via bracket notation for testing
    const locks = (
      handler as unknown as { accountLocks: Map<string, Promise<void>> }
    ).accountLocks;
    expect(locks.has(accountId)).toBe(false);
  });

  it("should handle multiple concurrent updates for same account sequentially", async () => {
    const accountId = "acc-1";
    const account = new Account(
      accountId,
      "Test",
      "BANK",
      "ASSET" as AccountCategory,
      1000,
      "user-1",
      "USD",
      null,
      null,
      null,
      new Date(),
      new Date(),
      1,
    );

    let resolveUpdate: (val: Account | PromiseLike<Account>) => void;
    const updatePromise = new Promise<Account>((resolve) => {
      resolveUpdate = resolve;
    });

    accountRepo.findById.mockResolvedValue(account);
    accountRepo.update.mockImplementation(() => updatePromise);

    // Trigger two updates
    const p1 = handler.handleCreated({
      accountId,
      amount: 100,
      type: "INCOME",
    } as unknown as Parameters<AccountBalanceEventHandler["handleCreated"]>[0]);
    const p2 = handler.handleCreated({
      accountId,
      amount: 200,
      type: "INCOME",
    } as unknown as Parameters<AccountBalanceEventHandler["handleCreated"]>[0]);

    const locks = (
      handler as unknown as { accountLocks: Map<string, Promise<void>> }
    ).accountLocks;
    expect(locks.has(accountId)).toBe(true);

    // Resolve first update
    resolveUpdate(account);
    await p1;

    // After p1 is done, p2 should still be in progress or just finished.
    // We wait for p2.
    await p2;

    expect(locks.has(accountId)).toBe(false);
    expect(accountRepo.update).toHaveBeenCalledTimes(2);
  });

  it("should not adjust balance if relevant fields (account, amount, type) have not changed", async () => {
    const accountId = "acc-1";
    const account = new Account(
      accountId,
      "Test",
      "BANK",
      "ASSET" as AccountCategory,
      1000,
      "user-1",
      "USD",
      null,
      null,
      null,
      new Date(),
      new Date(),
      1,
    );

    accountRepo.findById.mockResolvedValue(account);
    accountRepo.update.mockResolvedValue(account);

    // Call handleUpdated with no changes to balance-affecting fields
    await handler.handleUpdated({
      transactionId: "tx-1",
      userId: "user-1",
      previousAccountId: accountId,
      newAccountId: accountId,
      previousAmount: 100,
      newAmount: 100,
      previousType: "INCOME",
      newType: "INCOME",
    } as unknown as Parameters<AccountBalanceEventHandler["handleUpdated"]>[0]);

    expect(accountRepo.update).not.toHaveBeenCalled();
  });

  it("should adjust balance when relevant fields change", async () => {
    const oldAccountId = "acc-1";
    const newAccountId = "acc-2";
    const oldAccount = new Account(
      oldAccountId,
      "Old",
      "BANK",
      "ASSET" as AccountCategory,
      1000,
      "user-1",
      "USD",
      null,
      null,
      null,
      new Date(),
      new Date(),
      1,
    );
    const newAccount = new Account(
      newAccountId,
      "New",
      "BANK",
      "ASSET" as AccountCategory,
      2000,
      "user-1",
      "USD",
      null,
      null,
      null,
      new Date(),
      new Date(),
      1,
    );

    accountRepo.findById.mockImplementation((id: string) => {
      if (id === oldAccountId) return Promise.resolve(oldAccount);
      if (id === newAccountId) return Promise.resolve(newAccount);
      return Promise.resolve(null);
    });
    accountRepo.update.mockResolvedValue(oldAccount);

    // Call handleUpdated with account change
    await handler.handleUpdated({
      transactionId: "tx-1",
      userId: "user-1",
      previousAccountId: oldAccountId,
      newAccountId: newAccountId,
      previousAmount: 100,
      newAmount: 200,
      previousType: "INCOME",
      newType: "INCOME",
    } as unknown as Parameters<AccountBalanceEventHandler["handleUpdated"]>[0]);

    expect(accountRepo.update).toHaveBeenCalledTimes(2);

    // Verify first call: reverse old income (1000 - 100 = 900)
    const firstUpdate = accountRepo.update.mock.calls[0][0];
    expect(firstUpdate.id).toBe(oldAccountId);
    expect(firstUpdate.balance).toBe(900);

    // Verify second call: apply new income (2000 + 200 = 2200)
    const secondUpdate = accountRepo.update.mock.calls[1][0];
    expect(secondUpdate.id).toBe(newAccountId);
    expect(secondUpdate.balance).toBe(2200);
  });
});
