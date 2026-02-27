import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { Currency } from "../../domain/value-objects/currency";
import { LiabilityType } from "../../domain/value-objects/liability-type";

export const UpdateLiabilitySchema = z.object({
  name: z.string().optional(),
  type: z.nativeEnum(LiabilityType).optional(),
  amount: z.number().optional(),
  currency: z.nativeEnum(Currency).optional(),
  paidAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export class UpdateLiabilityDto extends createZodDto(UpdateLiabilitySchema) {}
