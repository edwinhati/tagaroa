import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { CurrencySchema } from "../../domain/value-objects/currency";
import { TransactionTypeSchema } from "../../domain/value-objects/transaction-type";

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
    currency: CurrencySchema,
    type: TransactionTypeSchema,
    notes: z.string().optional(),
    files: z.array(z.string()).optional(),
    account_id: z.uuid(),
    budget_item_id: z.preprocess(
      (val) => (val === "" ? null : val),
      z.uuid().nullable().optional(),
    ),
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
