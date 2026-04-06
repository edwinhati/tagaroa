import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { Currency } from "../../domain/value-objects/currency";
import { TransactionType } from "../../domain/value-objects/transaction-type";

const UpdateTransactionSchema = z
  .object({
    amount: z.number().min(0.01).optional(),
    date: z.string().optional(),
    currency: z.nativeEnum(Currency).optional(),
    type: z.nativeEnum(TransactionType).optional(),
    notes: z.string().optional(),
    files: z.array(z.string()).optional(),
    account_id: z.string().uuid().optional(),
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

export class UpdateTransactionDto extends createZodDto(
  UpdateTransactionSchema,
) {}
