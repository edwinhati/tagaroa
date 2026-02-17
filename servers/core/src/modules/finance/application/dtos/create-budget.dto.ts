import { IsEnum, IsInt, IsNumber, Max, Min } from "class-validator";
import { Currency } from "../../domain/value-objects/currency";

export class CreateBudgetDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsEnum(Currency)
  currency!: Currency;
}
