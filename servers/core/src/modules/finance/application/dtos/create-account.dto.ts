import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { AccountType } from "../../domain/value-objects/account-type";
import { Currency } from "../../domain/value-objects/currency";

export const CreateAccountSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(AccountType),
  balance: z.number().optional(),
  currency: z.nativeEnum(Currency),
  notes: z.string().nullable().optional(),
});

export class CreateAccountDto extends createZodDto(CreateAccountSchema) {}
