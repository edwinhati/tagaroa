import { z } from "zod";
import { createZodDto } from "../../../../../shared/pipes/zod-validation.pipe";
import { PositionSide } from "../../../domain/value-objects/position-side.value-object";

const AddPositionSchema = z.object({
  instrumentId: z.string().uuid(),
  quantity: z.number().min(0.00000001),
  averageCost: z.number().min(0),
  side: z.nativeEnum(PositionSide),
  openedAt: z.string(),
  fees: z.number().min(0).optional(),
});

export class AddPositionDto extends createZodDto(AddPositionSchema) {}
