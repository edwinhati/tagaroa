import { describe, expect, it } from "bun:test";
import { CreateTransactionDto } from "./create-transaction.dto";
import { UpdateTransactionDto } from "./update-transaction.dto";

describe("Transaction DTOs", () => {
  describe("UpdateTransactionDto", () => {
    it("should allow empty string for budget_item_id and transform it to null", () => {
      const data = {
        budget_item_id: "",
        amount: 100,
      };

      const result = UpdateTransactionDto._schema.parse(data);
      expect(result.budgetItemId).toBeNull();
      expect(result.amount).toBe(100);
    });

    it("should allow null for budget_item_id and transform it to null", () => {
      const data = {
        budget_item_id: null,
      };

      const result = UpdateTransactionDto._schema.parse(data);
      expect(result.budgetItemId).toBeNull();
    });

    it("should validate valid UUID for budget_item_id", () => {
      const uuid = "d78f7326-dda7-40cc-b16a-5266ccbf59f6";
      const data = {
        budget_item_id: uuid,
      };

      const result = UpdateTransactionDto._schema.parse(data);
      expect(result.budgetItemId).toBe(uuid);
    });

    it("should fail for invalid UUID format", () => {
      const data = {
        budget_item_id: "not-a-uuid",
      };

      expect(() => UpdateTransactionDto._schema.parse(data)).toThrow();
    });
  });

  describe("CreateTransactionDto", () => {
    const validBase = {
      amount: 100,
      date: "2024-01-01",
      currency: "USD",
      type: "EXPENSE",
      account_id: "d78f7326-dda7-40cc-b16a-5266ccbf59f6",
    };

    it("should allow empty string for budget_item_id and transform it to null", () => {
      const data = {
        ...validBase,
        budget_item_id: "",
      };

      const result = CreateTransactionDto._schema.parse(data);
      expect(result.budgetItemId).toBeNull();
    });

    it("should allow null for budget_item_id and transform it to null", () => {
      const data = {
        ...validBase,
        budget_item_id: null,
      };

      const result = CreateTransactionDto._schema.parse(data);
      expect(result.budgetItemId).toBeNull();
    });
  });
});
