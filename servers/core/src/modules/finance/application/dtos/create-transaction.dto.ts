import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { Currency } from "../../domain/value-objects/currency";
import { TransactionType } from "../../domain/value-objects/transaction-type";

// Frontend sends account_id / budget_item_id (snake_case) — transform to camelCase
export const CreateTransactionSchema = z
  .object({
    amount: z.number().min(0.01),
    date: z.string(),
    currency: z.nativeEnum(Currency),
    type: z.nativeEnum(TransactionType),
    notes: z.string().optional(),
    files: z.array(z.string()).optional(),
    account_id: z.string().uuid(),
    budget_item_id: z
      .string()
      .uuid()
      .nullish()
      .transform((v) => v ?? undefined),
  })
  .transform(({ account_id, budget_item_id, ...rest }) => ({
    ...rest,
    accountId: account_id,
    budgetItemId: budget_item_id,
  }));

export class CreateTransactionDto extends createZodDto(
  CreateTransactionSchema,
) {}
