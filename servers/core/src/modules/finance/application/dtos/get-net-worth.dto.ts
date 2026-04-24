import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";

const GetNetWorthSchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  currency: z.string().optional(),
});

export class GetNetWorthDto extends createZodDto(GetNetWorthSchema) {}
