import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { Currency } from "../../domain/value-objects/currency";
import { LiabilityType } from "../../domain/value-objects/liability-type";

export class UpdateLiabilityDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(LiabilityType)
  @IsOptional()
  type?: LiabilityType;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @IsDateString()
  @IsOptional()
  paidAt?: string | null;

  @IsString()
  @IsOptional()
  notes?: string | null;
}
