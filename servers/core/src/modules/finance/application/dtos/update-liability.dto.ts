import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { Currency } from "../../domain/value-objects/currency";
import { LiabilityType } from "../../domain/value-objects/liability-type";

const UpdateLiabilitySchema = z.object({
  name: z.string().optional(),
  type: z.enum(LiabilityType).optional(),
  amount: z.number().optional(),
  currency: z.enum(Currency).optional(),
  paidAt: z.iso.datetime({ offset: true }).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export class UpdateLiabilityDto extends createZodDto(UpdateLiabilitySchema) {}
