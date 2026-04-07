import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { AccountType } from "../../domain/value-objects/account-type";
import { Currency } from "../../domain/value-objects/currency";

import { MetadataSchema } from "../schemas/account-metadata.schema";

const CreateAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(AccountType),
  balance: z.number().optional(),
  currency: z.enum(Currency),
  notes: z.string().nullable().optional(),
  metadata: MetadataSchema,
});

export class CreateAccountDto extends createZodDto(CreateAccountSchema) {}
