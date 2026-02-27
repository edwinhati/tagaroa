import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { TransactionType } from "../../domain/value-objects/transaction-type";

// Query params come in as strings — use coerce for numbers, preprocess for arrays
const commaSplit = (v: unknown) =>
  typeof v === "string" ? v.split(",").filter(Boolean) : v;

export const GetTransactionsSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).optional(),
    search: z.string().optional(),
    order_by: z.string().optional(),
    type: z
      .preprocess(commaSplit, z.array(z.nativeEnum(TransactionType)))
      .optional(),
    account_id: z.preprocess(commaSplit, z.array(z.string().uuid())).optional(),
    budget_item_id: z
      .preprocess(commaSplit, z.array(z.string().uuid()))
      .optional(),
    currency: z.preprocess(commaSplit, z.array(z.string())).optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .transform(
    ({
      order_by,
      account_id,
      budget_item_id,
      start_date,
      end_date,
      ...rest
    }) => ({
      ...rest,
      orderBy: order_by,
      accountId: account_id,
      budgetItemId: budget_item_id,
      startDate: start_date,
      endDate: end_date,
    }),
  );

export class GetTransactionsDto extends createZodDto(GetTransactionsSchema) {}
