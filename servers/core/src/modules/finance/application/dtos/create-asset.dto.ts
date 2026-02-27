import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { AssetType } from "../../domain/value-objects/asset-type";
import { Currency } from "../../domain/value-objects/currency";

export const CreateAssetSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(AssetType),
  value: z.number().optional(),
  shares: z.number().nullable().optional(),
  ticker: z.string().nullable().optional(),
  currency: z.nativeEnum(Currency),
  notes: z.string().nullable().optional(),
});

export class CreateAssetDto extends createZodDto(CreateAssetSchema) {}
