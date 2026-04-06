import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { Currency } from "../../domain/value-objects/currency";

const CreateBudgetSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  amount: z.number().min(0),
  currency: z.nativeEnum(Currency),
});

export class CreateBudgetDto extends createZodDto(CreateBudgetSchema) {}
