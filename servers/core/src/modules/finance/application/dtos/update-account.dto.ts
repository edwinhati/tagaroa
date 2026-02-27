import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";

export const UpdateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  balance: z.number().optional(),
  notes: z.string().nullable().optional(),
});

export class UpdateAccountDto extends createZodDto(UpdateAccountSchema) {}
