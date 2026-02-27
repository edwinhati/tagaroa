import { z } from "zod";
import { createZodDto } from "../../../../../shared/pipes/zod-validation.pipe";
import { Timeframe } from "../../../domain/value-objects/timeframe.value-object";

export const SyncOhlcvSchema = z.object({
  instrumentId: z.string().uuid(),
  timeframe: z.nativeEnum(Timeframe),
  startDate: z.string(),
  endDate: z.string(),
});

export class SyncOhlcvDto extends createZodDto(SyncOhlcvSchema) {}
