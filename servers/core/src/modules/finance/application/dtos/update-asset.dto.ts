import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { AssetType } from "../../domain/value-objects/asset-type";
import { Currency } from "../../domain/value-objects/currency";

export class UpdateAssetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(AssetType)
  @IsOptional()
  type?: AssetType;

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsNumber()
  @IsOptional()
  shares?: number | null;

  @IsString()
  @IsOptional()
  ticker?: string | null;

  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @IsString()
  @IsOptional()
  notes?: string | null;
}
