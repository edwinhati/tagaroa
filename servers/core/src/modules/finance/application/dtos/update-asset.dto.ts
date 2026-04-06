import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { AssetType } from "../../domain/value-objects/asset-type";
import { Currency } from "../../domain/value-objects/currency";

const UpdateAssetSchema = z.object({
  name: z.string().optional(),
  type: z.nativeEnum(AssetType).optional(),
  value: z.number().optional(),
  shares: z.number().nullable().optional(),
  ticker: z.string().nullable().optional(),
  currency: z.nativeEnum(Currency).optional(),
  notes: z.string().nullable().optional(),
});

export class UpdateAssetDto extends createZodDto(UpdateAssetSchema) {}
