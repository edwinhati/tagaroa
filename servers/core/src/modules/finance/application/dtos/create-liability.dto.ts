import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { Currency } from "../../domain/value-objects/currency";
import { LiabilityType } from "../../domain/value-objects/liability-type";

export class CreateLiabilityDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(LiabilityType)
  type!: LiabilityType;

  @IsNumber()
  @IsOptional()
  amount?: number = 0;

  @IsEnum(Currency)
  currency!: Currency;

  @IsDateString()
  @IsOptional()
  paidAt?: string | null;

  @IsString()
  @IsOptional()
  notes?: string | null;
}
