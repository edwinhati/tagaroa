import { z } from "zod";
import { createZodDto } from "../../../../../shared/pipes/zod-validation.pipe";

export const GetExpenseBreakdownSchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export class GetExpenseBreakdownDto extends createZodDto(
  GetExpenseBreakdownSchema,
) {}
