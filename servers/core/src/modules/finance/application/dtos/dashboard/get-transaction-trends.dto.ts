import { IsDateString, IsIn, IsOptional } from "class-validator";

export class GetTransactionTrendsDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsIn(["day", "week", "month", "year"])
  granularity?: string = "month";
}
