import { z } from "zod";
import { createZodDto } from "../../../../../shared/pipes/zod-validation.pipe";

const GetTransactionTrendsSchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  granularity: z.enum(["day", "week", "month", "year"]).optional(),
});

export class GetTransactionTrendsDto extends createZodDto(
  GetTransactionTrendsSchema,
) {}
