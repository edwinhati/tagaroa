import { Expose } from "class-transformer";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { AccountType } from "../../domain/value-objects/account-type";
import { Currency } from "../../domain/value-objects/currency";

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(AccountType)
  type!: AccountType;

  @IsNumber()
  @IsOptional()
  balance?: number = 0;

  @IsEnum(Currency)
  currency!: Currency;

  @IsString()
  @IsOptional()
  notes?: string | null;
}
