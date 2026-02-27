import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";

// Frontend sends { allocation, budget_id } — transform budget_id → budgetId
export const UpdateBudgetItemSchema = z
  .object({
    allocation: z.number().min(0),
    budget_id: z.string().uuid(),
  })
  .transform(({ budget_id, ...rest }) => ({
    ...rest,
    budgetId: budget_id,
  }));

export class UpdateBudgetItemDto extends createZodDto(UpdateBudgetItemSchema) {}
