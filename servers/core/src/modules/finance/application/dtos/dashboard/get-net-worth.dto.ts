import { IsDateString, IsOptional, IsString } from "class-validator";

export class GetNetWorthDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}
