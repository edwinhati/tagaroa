import { z } from "zod";

// Credit account metadata schema
const CreditMetadataSchema = z.object({
  creditLimit: z.number().min(0).optional(),
  availableCredit: z.number().min(0).optional(),
  billingCycleDay: z.number().int().min(1).max(31).optional(),
  minimumPayment: z.number().min(0).optional(),
  nextDueDate: z.iso.datetime().optional(),
  interestRate: z.number().min(0).max(100).optional(),
});

// Asset account metadata schema
const AssetMetadataSchema = z.object({
  accountNumber: z.string().optional(),
  provider: z.string().optional(),
  isDefault: z.boolean().optional(),
  interestRate: z.number().min(0).optional(),
});

// Union metadata schema - accepts either credit or asset metadata
export const MetadataSchema = z
  .union([
    CreditMetadataSchema,
    AssetMetadataSchema,
    z.record(z.string(), z.unknown()),
  ])
  .optional();
