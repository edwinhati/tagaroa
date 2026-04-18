import { z } from "zod";
import { createZodDto } from "../../../../shared/pipes/zod-validation.pipe";
import { AssetTypeSchema } from "../../domain/value-objects/asset-type";
import { CurrencySchema } from "../../domain/value-objects/currency";

const CreateAssetSchema = z.object({
  name: z.string().min(1),
  type: AssetTypeSchema,
  value: z.number().optional(),
  shares: z.number().nullable().optional(),
  ticker: z.string().nullable().optional(),
  currency: CurrencySchema,
  notes: z.string().nullable().optional(),
});

export class CreateAssetDto extends createZodDto(CreateAssetSchema) {}
