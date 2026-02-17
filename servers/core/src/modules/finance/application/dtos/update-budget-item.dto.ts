import { Expose } from "class-transformer";
import { IsNumber, IsUUID, Min } from "class-validator";

export class UpdateBudgetItemDto {
  @IsNumber()
  @Min(0)
  allocation!: number;

  @IsUUID()
  @Expose({ name: "budget_id" })
  budgetId!: string;
}
