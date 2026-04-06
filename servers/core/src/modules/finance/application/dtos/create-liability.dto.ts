import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { Currency } from "../../domain/value-objects/currency";
import { LiabilityType } from "../../domain/value-objects/liability-type";

const CreateLiabilitySchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(LiabilityType),
  amount: z.number().optional(),
  currency: z.nativeEnum(Currency),
  paidAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export class CreateLiabilityDto extends createZodDto(CreateLiabilitySchema) {}
