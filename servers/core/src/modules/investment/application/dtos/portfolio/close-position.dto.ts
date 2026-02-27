import { z } from "zod";
import { createZodDto } from "../../../../../shared/pipes/zod-validation.pipe";

export const ClosePositionSchema = z.object({
  price: z.number().min(0),
  quantity: z.number().min(0.00000001).optional(),
  fees: z.number().min(0).optional(),
});

export class ClosePositionDto extends createZodDto(ClosePositionSchema) {}
