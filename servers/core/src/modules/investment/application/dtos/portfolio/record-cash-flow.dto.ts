import { z } from "zod";
import { createZodDto } from "../../../../../shared/pipes/zod-validation.pipe";
import { CashFlowType } from "../../../domain/value-objects/cash-flow-type.value-object";

export const RecordCashFlowSchema = z.object({
  type: z.nativeEnum(CashFlowType),
  amount: z.number().min(0.00000001),
  description: z.string().min(1).max(500).optional(),
  timestamp: z.string().optional(),
});

export class RecordCashFlowDto extends createZodDto(RecordCashFlowSchema) {}
