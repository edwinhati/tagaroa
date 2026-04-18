import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { AssetTypeSchema } from "../../domain/value-objects/asset-type";
import { CurrencySchema } from "../../domain/value-objects/currency";

const UpdateAssetSchema = z.object({
  name: z.string().optional(),
  type: AssetTypeSchema.optional(),
  value: z.number().optional(),
  shares: z.number().nullable().optional(),
  ticker: z.string().nullable().optional(),
  currency: CurrencySchema.optional(),
  notes: z.string().nullable().optional(),
});

export class UpdateAssetDto extends createZodDto(UpdateAssetSchema) {}
