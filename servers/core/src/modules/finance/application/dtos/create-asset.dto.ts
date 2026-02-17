import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { AssetType } from "../../domain/value-objects/asset-type";
import { Currency } from "../../domain/value-objects/currency";

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(AssetType)
  type!: AssetType;

  @IsNumber()
  @IsOptional()
  value?: number = 0;

  @IsNumber()
  @IsOptional()
  shares?: number | null;

  @IsString()
  @IsOptional()
  ticker?: string | null;

  @IsEnum(Currency)
  currency!: Currency;

  @IsString()
  @IsOptional()
  notes?: string | null;
}
