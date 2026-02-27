import { z } from "zod";
import { createZodDto } from "../../../../../shared/pipes/zod-validation.pipe";
import { PortfolioMode } from "../../../domain/value-objects/portfolio-mode.value-object";

export const CreatePortfolioSchema = z.object({
  name: z.string().min(1).max(255),
  mode: z.nativeEnum(PortfolioMode),
  initialCapital: z.number().min(0),
  currency: z.string().min(3).max(8),
});

export class CreatePortfolioDto extends createZodDto(CreatePortfolioSchema) {}
