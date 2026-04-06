import { z } from "zod";
import { createZodDto } from "../../../../../shared/pipes/zod-validation.pipe";
import { AssetClass } from "../../../domain/value-objects/asset-class.value-object";

const RegisterInstrumentSchema = z.object({
  ticker: z.string().min(1).max(32),
  name: z.string().min(1).max(255),
  assetClass: z.nativeEnum(AssetClass),
  exchange: z.string().min(1).max(255).nullable().optional(),
  currency: z.string().min(3).max(8),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export class RegisterInstrumentDto extends createZodDto(
  RegisterInstrumentSchema,
) {}
