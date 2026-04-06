import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";

const UpdateBudgetSchema = z.object({
  amount: z.number().min(0).optional(),
});

export class UpdateBudgetDto extends createZodDto(UpdateBudgetSchema) {}
