import { z } from "zod";
import { createZodDto } from "../../../../../shared/pipes/zod-validation.pipe";

const GetBudgetPerformanceSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export class GetBudgetPerformanceDto extends createZodDto(
  GetBudgetPerformanceSchema,
) {}
