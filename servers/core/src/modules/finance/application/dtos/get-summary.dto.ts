import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";

const GetSummarySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  currency: z.string().optional(),
});

export class GetSummaryDto extends createZodDto(GetSummarySchema) {}
