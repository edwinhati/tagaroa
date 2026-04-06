import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { Currency } from "../../domain/value-objects/currency";
import { TransactionType } from "../../domain/value-objects/transaction-type";

// Installment schema for validation
const InstallmentSchema = z
  .object({
    tenure: z.number().min(1).max(60),
    interest_rate: z.number().min(0).max(100).default(0),
    monthly_amount: z.number().min(0),
  })
  .optional();

// Frontend sends account_id / budget_item_id (snake_case) — transform to camelCase
const CreateTransactionSchema = z
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
    installment: InstallmentSchema,
  })
  .transform(({ account_id, budget_item_id, ...rest }) => {
    const installment = rest.installment
      ? {
          tenure: rest.installment.tenure,
          interestRate: rest.installment.interest_rate,
          monthlyAmount: rest.installment.monthly_amount,
        }
      : undefined;
    return {
      ...rest,
      accountId: account_id,
      budgetItemId: budget_item_id,
      installment,
    };
  });

export class CreateTransactionDto extends createZodDto(
  CreateTransactionSchema,
) {}
