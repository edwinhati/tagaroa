import { z } from "zod";
import { createZodDto } from "../../../../../shared/pipes/zod-validation.pipe";

const GetInsightsSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
});

export class GetInsightsDto extends createZodDto(GetInsightsSchema) {}
