import { z } from "zod";
import { createZodDto } from "../../../../../shared/pipes/zod-validation.pipe";
import { PortfolioStatus } from "../../../domain/value-objects/portfolio-status.value-object";

export const UpdatePortfolioSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.nativeEnum(PortfolioStatus).optional(),
});

export class UpdatePortfolioDto extends createZodDto(UpdatePortfolioSchema) {}
