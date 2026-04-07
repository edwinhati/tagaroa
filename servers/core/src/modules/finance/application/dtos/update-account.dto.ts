import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";

import { MetadataSchema } from "../schemas/account-metadata.schema";

const UpdateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  balance: z.number().optional(),
  notes: z.string().nullable().optional(),
  metadata: MetadataSchema,
});

export class UpdateAccountDto extends createZodDto(UpdateAccountSchema) {}
